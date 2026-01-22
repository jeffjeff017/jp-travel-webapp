'use client'

import { useState, useCallback, useEffect } from 'react'
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
  const [showTraffic, setShowTraffic] = useState(true)
  const [routeInfo, setRouteInfo] = useState<{
    distance: string
    duration: string
    durationInTraffic?: string
    departureTime?: string
    arrivalTime?: string
    steps?: google.maps.DirectionsStep[]
  } | null>(null)

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
      // Home selected
      map.panTo({ lat: homeLocation.lat, lng: homeLocation.lng })
      map.setZoom(15)
      setShowHomeInfo(true)
      setSelectedTrip(null)
      
      // Calculate route if there are trips
      if (trips.length > 0) {
        calculateRoute(
          { lat: homeLocation.lat, lng: homeLocation.lng },
          { lat: trips[0].lat, lng: trips[0].lng }
        )
      } else {
        setDirections(null)
        setRouteInfo(null)
      }
    } else if (selectedTripId && selectedTripId > 0) {
      // Trip selected
      const trip = trips.find(t => t.id === selectedTripId)
      if (trip) {
        map.panTo({ lat: trip.lat, lng: trip.lng })
        map.setZoom(15)
        setSelectedTrip(trip)
        setShowHomeInfo(false)
        
        // Calculate route from home to this trip
        if (homeLocation) {
          calculateRoute(
            { lat: homeLocation.lat, lng: homeLocation.lng },
            { lat: trip.lat, lng: trip.lng }
          )
        }
      }
    } else {
      // Nothing selected - clear directions
      setDirections(null)
      setRouteInfo(null)
      setSelectedTrip(null)
      setShowHomeInfo(false)
    }
  }, [selectedTripId, map, homeLocation, trips, calculateRoute])

  // Auto-refresh route every 5 minutes for real-time updates
  useEffect(() => {
    if (!selectedTripId || !homeLocation) return

    const interval = setInterval(() => {
      if (selectedTripId === -1 && trips.length > 0) {
        calculateRoute(
          { lat: homeLocation.lat, lng: homeLocation.lng },
          { lat: trips[0].lat, lng: trips[0].lng }
        )
      } else if (selectedTripId > 0) {
        const trip = trips.find(t => t.id === selectedTripId)
        if (trip) {
          calculateRoute(
            { lat: homeLocation.lat, lng: homeLocation.lng },
            { lat: trip.lat, lng: trip.lng }
          )
        }
      }
    }, 5 * 60 * 1000) // Refresh every 5 minutes

    return () => clearInterval(interval)
  }, [selectedTripId, homeLocation, trips, calculateRoute])

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    
    // Fit bounds to show all markers including home
    if (trips.length > 0 || homeLocation) {
      const bounds = new google.maps.LatLngBounds()
      
      if (homeLocation) {
        bounds.extend({ lat: homeLocation.lat, lng: homeLocation.lng })
      }
      
      trips.forEach((trip) => {
        bounds.extend({ lat: trip.lat, lng: trip.lng })
      })
      
      if (trips.length > 0 || homeLocation) {
        map.fitBounds(bounds)
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 14) map.setZoom(14)
          google.maps.event.removeListener(listener)
        })
      }
    } else {
      map.setCenter(tokyoCenter)
      map.setZoom(12)
    }
  }, [trips, homeLocation])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMarkerClick = (trip: Trip) => {
    setSelectedTrip(trip)
    setShowHomeInfo(false)
    onTripSelect?.(trip.id)
  }

  const handleHomeClick = () => {
    setShowHomeInfo(true)
    setSelectedTrip(null)
    onTripSelect?.(-1)
  }

  // Open Google Maps for navigation
  const openGoogleMapsNavigation = (destination: { lat: number; lng: number; name: string }) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${homeLocation?.lat},${homeLocation?.lng}&destination=${destination.lat},${destination.lng}&travelmode=transit`
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
            onCloseClick={() => {
              setShowHomeInfo(false)
              onTripSelect?.(null)
            }}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-bold text-lg text-blue-700 mb-1 flex items-center gap-1">
                🏠 {homeLocation.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{homeLocation.address}</p>
              {routeInfo && (
                <div className="bg-blue-50 p-2 rounded text-xs text-blue-700 space-y-1">
                  <p className="font-medium">🚃 實時路線資訊</p>
                  <p>📏 距離：{routeInfo.distance}</p>
                  <p>⏱️ 預計時間：{routeInfo.duration}</p>
                  {routeInfo.departureTime && <p>🕐 出發時間：{routeInfo.departureTime}</p>}
                  {routeInfo.arrivalTime && <p>🏁 抵達時間：{routeInfo.arrivalTime}</p>}
                </div>
              )}
            </div>
          </InfoWindow>
        )}

        {/* Trip Info Window */}
        {selectedTrip && (
          <InfoWindow
            position={{ lat: selectedTrip.lat, lng: selectedTrip.lng }}
            onCloseClick={() => {
              setSelectedTrip(null)
              onTripSelect?.(null)
            }}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-bold text-lg text-sakura-700 mb-1">
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
              <div 
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: selectedTrip.info }}
              />
              {routeInfo && (
                <div className="bg-sakura-50 p-2 rounded text-xs text-sakura-700 mt-2 space-y-1">
                  <p className="font-medium">🚃 實時路線（從住所出發）</p>
                  <p>📏 距離：{routeInfo.distance}</p>
                  <p>⏱️ 預計時間：{routeInfo.duration}</p>
                  {routeInfo.durationInTraffic && (
                    <p>🚗 含交通狀況：{routeInfo.durationInTraffic}</p>
                  )}
                  {routeInfo.departureTime && <p>🕐 出發時間：{routeInfo.departureTime}</p>}
                  {routeInfo.arrivalTime && <p>🏁 抵達時間：{routeInfo.arrivalTime}</p>}
                  <button
                    onClick={() => openGoogleMapsNavigation({ 
                      lat: selectedTrip.lat, 
                      lng: selectedTrip.lng, 
                      name: selectedTrip.title 
                    })}
                    className="mt-2 w-full py-1.5 bg-sakura-500 hover:bg-sakura-600 text-white rounded text-xs font-medium transition-colors"
                  >
                    📍 開啟 Google Maps 導航
                  </button>
                </div>
              )}
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
