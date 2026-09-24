'use client';

import {useEffect, useRef} from 'react';

type LeafletModule = typeof import('leaflet');

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export function LocationMap({
  point,
  interactive = false,
  label,
  onChange
}: {
  point: MapPoint | null;
  interactive?: boolean;
  label: string;
  onChange?: (point: MapPoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialPointRef = useRef(point);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    void import('leaflet').then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = leaflet;
      const initialPoint = initialPointRef.current;
      const center: [number, number] = initialPoint
        ? [initialPoint.latitude, initialPoint.longitude]
        : [40.4093, 49.8671];
      const map = leaflet.map(containerRef.current, {
        attributionControl: true,
        scrollWheelZoom: false
      });
      map.setView(center, initialPoint ? 15 : 11);
      leaflet
        .tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }
        )
        .addTo(map);
      if (initialPoint) {
        markerRef.current = createMarker(leaflet, map, initialPoint);
      }
      if (interactive) {
        map.on('click', (event) => {
          onChangeRef.current?.({
            latitude: roundCoordinate(event.latlng.lat),
            longitude: roundCoordinate(event.latlng.lng)
          });
        });
      }
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) markerRef.current.setLatLng([point.latitude, point.longitude]);
    else markerRef.current = createMarker(leaflet, map, point);
    if (!map.getBounds().contains([point.latitude, point.longitude])) {
      map.panTo([point.latitude, point.longitude]);
    }
  }, [point]);

  return (
    <div
      aria-label={label}
      className="location-map"
      ref={containerRef}
      role={interactive ? 'application' : 'img'}
    />
  );
}

function createMarker(
  leaflet: LeafletModule,
  map: import('leaflet').Map,
  point: MapPoint
): import('leaflet').CircleMarker {
  return leaflet
    .circleMarker([point.latitude, point.longitude], {
      radius: 10,
      color: '#ffffff',
      weight: 4,
      fillColor: '#ed682d',
      fillOpacity: 1
    })
    .addTo(map);
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(5));
}
