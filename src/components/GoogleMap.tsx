'use client'

import { useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import type { Trip } from '@/lib/supabase'

const containerStyle = {
  width: '100%',
  height: '100%',
}

const defaultCenter = {
  lat: 35.6762,
  lng: 139.6503, // Tokyo
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

interface GoogleMapComponentProps {
  trips: Trip[]
}

export default function GoogleMapComponent({ trips }: GoogleMapComponentProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    
    // Fit bounds to show all markers
    if (trips.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      trips.forEach((trip) => {
        bounds.extend({ lat: trip.lat, lng: trip.lng })
      })
      map.fitBounds(bounds)
    }
  }, [trips])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-sakura-50">
        <div className="text-center p-4">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-gray-600">Error loading maps</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-sakura-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={6}
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
      {trips.map((trip) => (
        <Marker
          key={trip.id}
          position={{ lat: trip.lat, lng: trip.lng }}
          onClick={() => setSelectedTrip(trip)}
          icon={{
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
                <path fill="#e85d80" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle fill="white" cx="12" cy="9" r="2.5"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 36),
          }}
        />
      ))}

      {selectedTrip && (
        <InfoWindow
          position={{ lat: selectedTrip.lat, lng: selectedTrip.lng }}
          onCloseClick={() => setSelectedTrip(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-lg text-sakura-700 mb-1">
              {selectedTrip.title}
            </h3>
            <p className="text-sm text-gray-600 mb-2">{selectedTrip.location}</p>
            <p className="text-xs text-gray-500 mb-2">
              📅 {new Date(selectedTrip.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-sm text-gray-700">{selectedTrip.info}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
