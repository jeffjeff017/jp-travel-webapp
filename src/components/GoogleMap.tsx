'use client'

import { useState, useCallback, useEffect } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api'
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

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  })

  // Handle selected trip from sidebar
  useEffect(() => {
    if (!map || selectedTripId === undefined) return

    if (selectedTripId === -1 && homeLocation) {
      // Home selected - show route from home to first trip or center on home
      map.panTo({ lat: homeLocation.lat, lng: homeLocation.lng })
      map.setZoom(15)
      setShowHomeInfo(true)
      setSelectedTrip(null)
      
      // Calculate route if there are trips
      if (trips.length > 0) {
        const directionsService = new google.maps.DirectionsService()
        directionsService.route(
          {
            origin: { lat: homeLocation.lat, lng: homeLocation.lng },
            destination: { lat: trips[0].lat, lng: trips[0].lng },
            travelMode: google.maps.TravelMode.TRANSIT,
          },
          (result, status) => {
            if (status === 'OK' && result) {
              setDirections(result)
            }
          }
        )
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
          const directionsService = new google.maps.DirectionsService()
          directionsService.route(
            {
              origin: { lat: homeLocation.lat, lng: homeLocation.lng },
              destination: { lat: trip.lat, lng: trip.lng },
              travelMode: google.maps.TravelMode.TRANSIT,
            },
            (result, status) => {
              if (status === 'OK' && result) {
                setDirections(result)
              }
            }
          )
        }
      }
    } else {
      // Nothing selected - clear directions
      setDirections(null)
      setSelectedTrip(null)
      setShowHomeInfo(false)
    }
  }, [selectedTripId, map, homeLocation, trips])

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
        // Don't zoom in too much
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
      {/* Home Location Marker */}
      {homeLocation && (
        <Marker
          position={{ lat: homeLocation.lat, lng: homeLocation.lng }}
          onClick={handleHomeClick}
          icon={{
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
                <path fill="#3B82F6" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle fill="white" cx="12" cy="9" r="4"/>
                <text x="12" y="11" text-anchor="middle" font-size="6" fill="#3B82F6">🏠</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 40),
          }}
        />
      )}

      {/* Trip Markers */}
      {trips.map((trip) => (
        <Marker
          key={trip.id}
          position={{ lat: trip.lat, lng: trip.lng }}
          onClick={() => handleMarkerClick(trip)}
          icon={{
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
                <path fill="${selectedTripId === trip.id ? '#be185d' : '#e85d80'}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle fill="white" cx="12" cy="9" r="2.5"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 36),
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
              strokeWeight: 4,
              strokeOpacity: 0.8,
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
            {directions && (
              <div className="bg-blue-50 p-2 rounded text-xs text-blue-700">
                <p className="font-medium">🚃 路線資訊</p>
                <p>距離：{directions.routes[0]?.legs[0]?.distance?.text}</p>
                <p>時間：{directions.routes[0]?.legs[0]?.duration?.text}</p>
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
            {directions && (
              <div className="bg-sakura-50 p-2 rounded text-xs text-sakura-700 mt-2">
                <p className="font-medium">🚃 從住所出發</p>
                <p>距離：{directions.routes[0]?.legs[0]?.distance?.text}</p>
                <p>時間：{directions.routes[0]?.legs[0]?.duration?.text}</p>
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
