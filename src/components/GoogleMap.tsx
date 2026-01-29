'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, TrafficLayer } from '@react-google-maps/api'
import type { Trip } from '@/lib/supabase'

const containerStyle = {
  width: '100%',
  height: '100%',
}

// Tokyo coordinates as default center
const tokyoCenter = {
  lat: 35.6762,
  lng: 139.6503,
}

const mapStyles = [
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9e7f5' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#d4ecd0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#ffeaea' }],
  },
]

interface HomeLocation {
  name: string
  address: string
  lat: number
  lng: number
  imageUrl?: string
}

interface GoogleMapComponentProps {
  trips: Trip[]
  homeLocation?: HomeLocation
  selectedTripId?: number | null
  onTripSelect?: (id: number | null) => void
}

export default function GoogleMapComponent({ 
  trips, 
  homeLocation,
  selectedTripId,
  onTripSelect 
}: GoogleMapComponentProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [showHomeInfo, setShowHomeInfo] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [showTraffic, setShowTraffic] = useState(false)
  const [infoImageIndex, setInfoImageIndex] = useState(0)
  const [showAllScheduleItems, setShowAllScheduleItems] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance: string
    duration: string
    durationInTraffic?: string
    departureTime?: string
    arrivalTime?: string
    steps?: google.maps.DirectionsStep[]
  } | null>(null)
  
  // Refs to prevent map jumping
  const initialBoundsSet = useRef(false)
  const lastTripIds = useRef<string>('')
  
  // Get user's current location
  const getCurrentLocation = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'))
        return
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setCurrentLocation(location)
          resolve(location)
        },
        (error) => {
          console.error('Geolocation error:', error)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        }
      )
    })
  }, [])

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  })

  // Calculate route with real-time traffic
  const calculateRoute = useCallback((
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) => {
    if (!window.google) return

    const directionsService = new google.maps.DirectionsService()
    
    // Request with departure time for real-time traffic
    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.TRANSIT,
        transitOptions: {
          departureTime: new Date(), // Current time for real-time
        },
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result)
          
          const leg = result.routes[0]?.legs[0]
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.text || '',
              duration: leg.duration?.text || '',
              durationInTraffic: leg.duration_in_traffic?.text,
              departureTime: leg.departure_time?.text,
              arrivalTime: leg.arrival_time?.text,
              steps: leg.steps,
            })
          }
        } else {
          // Fallback to driving if transit fails
          directionsService.route(
            {
              origin,
              destination,
              travelMode: google.maps.TravelMode.DRIVING,
              drivingOptions: {
                departureTime: new Date(),
                trafficModel: google.maps.TrafficModel.BEST_GUESS,
              },
            },
            (result, status) => {
              if (status === 'OK' && result) {
                setDirections(result)
                
                const leg = result.routes[0]?.legs[0]
                if (leg) {
                  setRouteInfo({
                    distance: leg.distance?.text || '',
                    duration: leg.duration?.text || '',
                    durationInTraffic: leg.duration_in_traffic?.text,
                  })
                }
              }
            }
          )
        }
      }
    )
  }, [])

  // Handle selected trip from sidebar
  useEffect(() => {
    if (!map || selectedTripId === undefined) return

    if (selectedTripId === -1 && homeLocation) {
      // Home selected - just show info, no auto navigation
      map.panTo({ lat: homeLocation.lat, lng: homeLocation.lng })
      map.setZoom(15)
      setShowHomeInfo(true)
      setSelectedTrip(null)
      // Clear any existing directions
      setDirections(null)
      setRouteInfo(null)
    } else if (selectedTripId && selectedTripId > 0) {
      // Trip selected - just show info, no auto navigation
      const trip = trips.find(t => t.id === selectedTripId)
      if (trip) {
        map.panTo({ lat: trip.lat, lng: trip.lng })
        map.setZoom(15)
        setSelectedTrip(trip)
        setShowHomeInfo(false)
        // Clear any existing directions
        setDirections(null)
        setRouteInfo(null)
      }
    } else {
      // Nothing selected - clear everything
      setDirections(null)
      setRouteInfo(null)
      setSelectedTrip(null)
      setShowHomeInfo(false)
    }
  }, [selectedTripId, map, homeLocation, trips])

  // Auto-refresh route every 5 minutes for real-time updates (only when route is shown)
  useEffect(() => {
    if (!directions || !currentLocation) return

    const interval = setInterval(() => {
      if (selectedTrip && currentLocation) {
        calculateRoute(
          currentLocation,
          { lat: selectedTrip.lat, lng: selectedTrip.lng }
        )
      }
    }, 5 * 60 * 1000) // Refresh every 5 minutes

    return () => clearInterval(interval)
  }, [directions, currentLocation, selectedTrip, calculateRoute])
  
  // Handle search query from main page
  useEffect(() => {
    if (!map || !isLoaded) return
    
    const searchQuery = localStorage.getItem('map_search_query')
    if (!searchQuery) return
    
    // Clear the search query immediately
    localStorage.removeItem('map_search_query')
    
    // Use Places service to search
    const service = new google.maps.places.PlacesService(map)
    const request = {
      query: searchQuery,
      region: 'jp', // Prefer Japan results
    }
    
    service.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        const place = results[0]
        if (place.geometry?.location) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name || searchQuery,
          }
          setSearchMarker(location)
          map.panTo({ lat: location.lat, lng: location.lng })
          map.setZoom(16)
        }
      }
    })
  }, [map, isLoaded])
  
  // Show navigation route from current location to selected trip
  const showNavigation = useCallback(async () => {
    if (!selectedTrip) return
    
    setIsGettingLocation(true)
    try {
      const location = await getCurrentLocation()
      calculateRoute(
        location,
        { lat: selectedTrip.lat, lng: selectedTrip.lng }
      )
    } catch (error) {
      alert('無法取得當前位置，請確認已開啟定位權限')
    } finally {
      setIsGettingLocation(false)
    }
  }, [selectedTrip, calculateRoute, getCurrentLocation])
  
  // Clear navigation
  const clearNavigation = useCallback(() => {
    setDirections(null)
    setRouteInfo(null)
  }, [])

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    
    // Only fit bounds on initial load
    if (!initialBoundsSet.current) {
      if (trips.length > 0 || homeLocation) {
        const bounds = new google.maps.LatLngBounds()
        
        if (homeLocation) {
          bounds.extend({ lat: homeLocation.lat, lng: homeLocation.lng })
        }
        
        trips.forEach((trip) => {
          bounds.extend({ lat: trip.lat, lng: trip.lng })
        })
        
        map.fitBounds(bounds)
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 14) map.setZoom(14)
          google.maps.event.removeListener(listener)
        })
      } else {
        map.setCenter(tokyoCenter)
        map.setZoom(12)
      }
      initialBoundsSet.current = true
      lastTripIds.current = trips.map(t => t.id).join(',')
    }
  }, [trips, homeLocation])
  
  // Only refit bounds when trips list significantly changes (different day selected)
  useEffect(() => {
    if (!map) return
    
    const currentTripIds = trips.map(t => t.id).join(',')
    if (currentTripIds !== lastTripIds.current && initialBoundsSet.current) {
      lastTripIds.current = currentTripIds
      
      // Smoothly fit to new bounds without jarring animation
      if (trips.length > 0 || homeLocation) {
        const bounds = new google.maps.LatLngBounds()
        
        if (homeLocation) {
          bounds.extend({ lat: homeLocation.lat, lng: homeLocation.lng })
        }
        
        trips.forEach((trip) => {
          bounds.extend({ lat: trip.lat, lng: trip.lng })
        })
        
        // Use panToBounds for smoother transition
        map.panToBounds(bounds, 50)
      }
    }
  }, [map, trips, homeLocation])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMarkerClick = (trip: Trip) => {
    setSelectedTrip(trip)
    setShowHomeInfo(false)
    setInfoImageIndex(0) // Reset image slider
    setShowAllScheduleItems(false) // Reset dropdown
    onTripSelect?.(trip.id)
  }

  const handleHomeClick = () => {
    setShowHomeInfo(true)
    setSelectedTrip(null)
    onTripSelect?.(-1)
  }

  // Open Google Maps for navigation from current location
  const openGoogleMapsNavigation = (destination: { lat: number; lng: number; name: string }) => {
    // Use current location if available, otherwise let Google Maps use device location
    const originParam = currentLocation 
      ? `&origin=${currentLocation.lat},${currentLocation.lng}` 
      : ''
    const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destination.lat},${destination.lng}&travelmode=transit`
    window.open(url, '_blank')
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-sakura-50">
        <div className="text-center p-4">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-gray-600">載入地圖時發生錯誤</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-sakura-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">載入地圖中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={tokyoCenter}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: mapStyles,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {/* Traffic Layer for real-time traffic */}
        {showTraffic && <TrafficLayer />}

        {/* Home Location Marker */}
        {homeLocation && (
          <Marker
            position={{ lat: homeLocation.lat, lng: homeLocation.lng }}
            onClick={handleHomeClick}
            icon={{
              url: 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
                  <path fill="#3B82F6" d="M24 4C16.26 4 10 10.26 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.74-6.26-14-14-14z"/>
                  <circle fill="white" cx="24" cy="18" r="8"/>
                  <text x="24" y="22" text-anchor="middle" font-size="12" fill="#3B82F6">🏠</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 48),
            }}
          />
        )}

        {/* Search Result Marker */}
        {searchMarker && (
          <Marker
            position={{ lat: searchMarker.lat, lng: searchMarker.lng }}
            onClick={() => {
              // Clear search marker when clicked
              setSearchMarker(null)
            }}
            icon={{
              url: 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="48" height="56">
                  <path fill="#10B981" stroke="white" stroke-width="2" d="M24 2C14.06 2 6 10.06 6 20c0 12 18 32 18 32s18-20 18-32c0-9.94-8.06-18-18-18z"/>
                  <circle fill="white" cx="24" cy="20" r="10"/>
                  <text x="24" y="24" text-anchor="middle" font-size="14" fill="#10B981">🔍</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(48, 56),
              anchor: new google.maps.Point(24, 56),
            }}
          />
        )}
        
        {/* Search Result Info Window */}
        {searchMarker && (
          <InfoWindow
            position={{ lat: searchMarker.lat, lng: searchMarker.lng }}
            options={{ 
              pixelOffset: new google.maps.Size(0, -50),
              maxWidth: 280
            }}
            onCloseClick={() => setSearchMarker(null)}
          >
            <div style={{ width: '200px' }} className="p-2">
              <h3 className="font-medium text-gray-800 mb-1">{searchMarker.name}</h3>
              <p className="text-xs text-gray-500 mb-2">搜尋結果</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${searchMarker.lat},${searchMarker.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded-full transition-colors"
              >
                在 Google Maps 開啟
              </a>
            </div>
          </InfoWindow>
        )}

        {/* Trip Markers - Larger */}
        {trips.map((trip, index) => (
          <Marker
            key={trip.id}
            position={{ lat: trip.lat, lng: trip.lng }}
            onClick={() => handleMarkerClick(trip)}
            label={{
              text: String(index + 1),
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            icon={{
              url: 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="48" height="56">
                  <path fill="${selectedTripId === trip.id ? '#be185d' : '#e85d80'}" stroke="white" stroke-width="2" d="M24 2C14.06 2 6 10.06 6 20c0 12 18 32 18 32s18-20 18-32c0-9.94-8.06-18-18-18z"/>
                  <circle fill="white" cx="24" cy="20" r="10"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(48, 56),
              anchor: new google.maps.Point(24, 56),
              labelOrigin: new google.maps.Point(24, 20),
            }}
          />
        ))}

        {/* Directions */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#e85d80',
                strokeWeight: 5,
                strokeOpacity: 0.9,
              },
            }}
          />
        )}

        {/* Home Info Window */}
        {showHomeInfo && homeLocation && (
          <InfoWindow
            position={{ lat: homeLocation.lat, lng: homeLocation.lng }}
            options={{ 
              pixelOffset: new google.maps.Size(0, -10),
              maxWidth: 280
            }}
          >
            <div style={{ width: '250px', overflow: 'hidden' }} className="relative">
              {/* Custom Circle Close Button */}
              <button
                onClick={() => {
                  setShowHomeInfo(false)
                  onTripSelect?.(null)
                }}
                className="absolute top-2 right-2 z-20 w-7 h-7 bg-white/90 hover:bg-white text-gray-600 hover:text-gray-800 rounded-full flex items-center justify-center shadow-md transition-colors"
                style={{ fontSize: '16px', lineHeight: 1 }}
              >
                ✕
              </button>
              {/* Home Image */}
              {homeLocation.imageUrl && (
                <img 
                  src={homeLocation.imageUrl} 
                  alt={homeLocation.name}
                  className="w-full object-cover rounded-t"
                  style={{ height: '120px' }}
                />
              )}
              <div className="p-3">
                <h3 className="font-bold text-base text-blue-700 mb-1 flex items-center gap-1">
                  🏠 {homeLocation.name}
                </h3>
                <p className="text-sm text-gray-600">{homeLocation.address}</p>
                <p className="text-xs text-blue-500 mt-1">點擊行程可查看導航路線</p>
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Trip Info Window */}
        {selectedTrip && (
          <InfoWindow
            position={{ lat: selectedTrip.lat, lng: selectedTrip.lng }}
            options={{ 
              pixelOffset: new google.maps.Size(0, -10),
              maxWidth: 280,
              disableAutoPan: false
            }}
          >
            <div style={{ width: '250px', overflow: 'hidden' }} className="relative">
              {/* Custom Circle Close Button */}
              <button
                onClick={() => {
                  setSelectedTrip(null)
                  onTripSelect?.(null)
                }}
                className="absolute top-2 right-2 z-20 w-7 h-7 bg-white/90 hover:bg-white text-gray-600 hover:text-gray-800 rounded-full flex items-center justify-center shadow-md transition-colors"
                style={{ fontSize: '16px', lineHeight: 1 }}
              >
                ✕
              </button>
              
              {/* Trip Image Slider - Parse JSON array or single URL */}
              {(() => {
                let images: string[] = []
                if (selectedTrip.image_url) {
                  try {
                    const parsed = JSON.parse(selectedTrip.image_url)
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      images = parsed
                    }
                  } catch {
                    if (selectedTrip.image_url.trim()) {
                      images = [selectedTrip.image_url]
                    }
                  }
                }
                
                if (images.length === 0) return null
                
                // Touch/swipe handlers
                let touchStartX = 0
                const handleTouchStart = (e: React.TouchEvent) => {
                  touchStartX = e.touches[0].clientX
                }
                const handleTouchEnd = (e: React.TouchEvent) => {
                  const touchEndX = e.changedTouches[0].clientX
                  const diff = touchStartX - touchEndX
                  if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                      // Swipe left - next image
                      setInfoImageIndex((prev) => (prev + 1) % images.length)
                    } else {
                      // Swipe right - previous image
                      setInfoImageIndex((prev) => (prev - 1 + images.length) % images.length)
                    }
                  }
                }
                
                return (
                  <div 
                    className="relative" 
                    style={{ height: '120px' }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img 
                      src={images[infoImageIndex] || images[0]} 
                      alt={selectedTrip.title}
                      className="w-full h-full object-cover rounded-t"
                    />
                    {/* Dots indicator - only show if multiple images */}
                    {images.length > 1 && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, idx) => (
                          <span 
                            key={idx} 
                            onClick={() => setInfoImageIndex(idx)}
                            className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${idx === infoImageIndex ? 'bg-white' : 'bg-white/50'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="p-3">
                <h3 className="font-bold text-base text-sakura-700 mb-1">
                  {selectedTrip.title}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{selectedTrip.location}</p>
                <p className="text-xs text-gray-500 mb-2">
                  📅 {new Date(selectedTrip.date).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                {/* Description - Parse JSON schedule items with dropdown for 3+ items */}
                <div className="text-sm text-gray-700">
                  {(() => {
                    if (!selectedTrip.description) return null
                    try {
                      const items = JSON.parse(selectedTrip.description)
                      if (Array.isArray(items) && items.length > 0) {
                        const displayItems = showAllScheduleItems ? items : items.slice(0, 2)
                        return (
                          <>
                            {displayItems.map((item: any, idx: number) => (
                              <div key={idx} className="text-xs mb-1">
                                {item.time_start && <span className="text-blue-600">{item.time_start} </span>}
                                <span>{item.content}</span>
                              </div>
                            ))}
                            {items.length > 2 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowAllScheduleItems(!showAllScheduleItems)
                                }}
                                className="text-xs text-sakura-500 hover:text-sakura-600 mt-1 flex items-center gap-1"
                              >
                                {showAllScheduleItems ? (
                                  <>收起 ▲</>
                                ) : (
                                  <>查看更多 ({items.length - 2}) ▼</>
                                )}
                              </button>
                            )}
                          </>
                        )
                      }
                    } catch {
                      // Legacy: plain text or HTML
                      return <span className="text-xs" dangerouslySetInnerHTML={{ __html: selectedTrip.description }} />
                    }
                    return null
                  })()}
                </div>
                
                {/* Navigation Section */}
                <div className="mt-3 space-y-2">
                  {routeInfo && (
                    <div className="bg-sakura-50 p-2 rounded text-xs text-sakura-700 space-y-1">
                      <p className="font-medium">🚃 路線資訊（從當前位置出發）</p>
                      <p>📏 距離：{routeInfo.distance}</p>
                      <p>⏱️ 預計時間：{routeInfo.duration}</p>
                      {routeInfo.durationInTraffic && (
                        <p>🚗 含交通狀況：{routeInfo.durationInTraffic}</p>
                      )}
                      {routeInfo.departureTime && <p>🕐 出發時間：{routeInfo.departureTime}</p>}
                      {routeInfo.arrivalTime && <p>🏁 抵達時間：{routeInfo.arrivalTime}</p>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {routeInfo ? (
                      <button
                        onClick={clearNavigation}
                        className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded text-xs font-medium transition-colors hover:bg-gray-50"
                      >
                        隱藏路線
                      </button>
                    ) : (
                      <button
                        onClick={showNavigation}
                        disabled={isGettingLocation}
                        className="flex-1 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        {isGettingLocation ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            定位中...
                          </>
                        ) : (
                          <>🗺️ 顯示路線</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => openGoogleMapsNavigation({ 
                        lat: selectedTrip.lat, 
                        lng: selectedTrip.lng, 
                        name: selectedTrip.title 
                      })}
                      className="flex-1 py-1.5 bg-sakura-500 hover:bg-sakura-600 text-white rounded text-xs font-medium transition-colors"
                    >
                      📍 Google Maps
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Traffic Toggle Button */}
      <button
        onClick={() => setShowTraffic(!showTraffic)}
        className={`absolute top-4 left-4 px-3 py-2 rounded-lg shadow-md text-sm font-medium transition-colors ${
          showTraffic 
            ? 'bg-green-500 text-white' 
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        🚦 {showTraffic ? '實時交通：開' : '實時交通：關'}
      </button>
    </div>
  )
}
