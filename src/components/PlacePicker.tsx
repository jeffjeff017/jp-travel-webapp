'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'

interface PlacePickerProps {
  value: {
    location: string
    lat: number
    lng: number
  }
  onChange: (value: { location: string; lat: number; lng: number }) => void
  onClose: () => void
}

const containerStyle = {
  width: '100%',
  height: '300px',
}

const tokyoCenter = {
  lat: 35.6762,
  lng: 139.6503,
}

export default function PlacePicker({ value, onChange, onClose }: PlacePickerProps) {
  const [searchInput, setSearchInput] = useState(value.location || '')
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number }>(
    value.lat && value.lng ? { lat: value.lat, lng: value.lng } : tokyoCenter
  )
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const searchBoxRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  })

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  useEffect(() => {
    if (isLoaded && searchBoxRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(searchBoxRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'jp' }, // Restrict to Japan
      })

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          const location = place.formatted_address || place.name || ''
          
          setMarkerPosition({ lat, lng })
          setSearchInput(location)
          
          if (map) {
            map.panTo({ lat, lng })
            map.setZoom(15)
          }
        }
      })
    }
  }, [isLoaded, map])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setMarkerPosition({ lat, lng })

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          setSearchInput(results[0].formatted_address)
        }
      })
    }
  }, [])

  const handleConfirm = () => {
    onChange({
      location: searchInput,
      lat: markerPosition.lat,
      lng: markerPosition.lng,
    })
    onClose()
  }

  if (!isLoaded) {
    return (
      <div className="p-4 text-center">
        <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          搜尋地點
        </label>
        <input
          ref={searchBoxRef}
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="輸入地點名稱或地址..."
          className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
        />
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-gray-200">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={markerPosition}
          zoom={13}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          <Marker
            position={markerPosition}
            draggable={true}
            onDragEnd={(e) => {
              if (e.latLng) {
                const lat = e.latLng.lat()
                const lng = e.latLng.lng()
                setMarkerPosition({ lat, lng })

                // Reverse geocode
                const geocoder = new google.maps.Geocoder()
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                  if (status === 'OK' && results?.[0]) {
                    setSearchInput(results[0].formatted_address)
                  }
                })
              }
            }}
          />
        </GoogleMap>
      </div>

      {/* Selected Location Info */}
      <div className="bg-gray-50 p-3 rounded-lg text-sm">
        <p className="text-gray-600">
          <span className="font-medium">已選地點：</span>
          {searchInput || '尚未選擇'}
        </p>
        <p className="text-gray-500 text-xs mt-1">
          座標：{markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg font-medium transition-colors"
        >
          確認選擇
        </button>
      </div>
    </div>
  )
}
