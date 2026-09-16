"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Rectangle,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import MarkerClusterGroup from "react-leaflet-cluster";

import "leaflet/dist/leaflet.css";

/* ============================================================
   THERMAL EVENT
============================================================ */

type ThermalEvent = {
  latitude: number;
  longitude: number;

  acq_date: string;
  acq_time: number;

  frp: number;
  confidence: string;
  daynight: string;

  classification: string;
  ai_confidence: number;

  risk_score: number;
  risk_level: string;
};

/* ============================================================
   REGIONAL HOTSPOT
============================================================ */

type RegionalHotspot = {
  latitude: number;
  longitude: number;
  event_count: number;
  max_risk: number;
  average_risk: number;
  critical_events: number;
  high_events: number;
  total_frp: number;
  max_persistence: number;

  // Regional intelligence indicators
  high_thermal_events: number;
  persistent_events: number;
  industrial_proximity_events: number;

  risk_level: string;
};

/* ============================================================
   MAP PROPS
============================================================ */

type ThermalMapProps = {
  events: ThermalEvent[];

  selectedEvent: number | null;

  selectedRegion: RegionalHotspot | null;

  onSelectEvent: (index: number) => void;

  onSelectRegion: (region: RegionalHotspot) => void;

  regionalHotspots: RegionalHotspot[];
};

/* ============================================================
   SAFE NUMBER FORMATTER
============================================================ */

function safeFixed(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "0";
}
function isValidCoordinate(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
/* ============================================================
   RISK COLOR
============================================================ */

function getRiskColor(riskLevel: string) {
  const level = (riskLevel || "").toLowerCase();

  if (level === "critical") {
    return "#ef4444";
  }

  if (level === "high") {
    return "#f97316";
  }

  if (level === "medium") {
    return "#eab308";
  }

  if (level === "low") {
    return "#22c55e";
  }

  return "#94a3b8";
}

/* ============================================================
   CLUSTER ICON
============================================================ */

/*
 * Cluster markers are intentionally subtle.
 *
 * They communicate density only.
 *
 * The actual thermal points remain visible separately.
 */

function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();

  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const marker of markers) {
    const riskLevel = String(
      (marker.options as any).thermosRiskLevel ?? "low",
    ).toLowerCase();

    if (riskLevel === "critical") {
      critical++;
    } else if (riskLevel === "high") {
      high++;
    } else if (riskLevel === "medium") {
      medium++;
    } else {
      low++;
    }
  }

  /*
   * Cluster color is determined by the dominant
   * risk level represented by its events.
   */
  let color = "#22c55e";

  if (critical >= high && critical >= medium && critical >= low) {
    color = "#ef4444";
  } else if (high >= medium && high >= low) {
    color = "#f97316";
  } else if (medium >= low) {
    color = "#eab308";
  }

  let size = 34;

  if (count >= 100) {
    size = 56;
  } else if (count >= 50) {
    size = 50;
  } else if (count >= 20) {
    size = 44;
  } else if (count >= 10) {
    size = 38;
  }

  return L.divIcon({
    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${color}22;
          border:1.5px solid ${color}88;
          box-shadow:0 1px 5px rgba(15,23,42,0.10);
          display:flex;
          align-items:center;
          justify-content:center;
          color:${color};
          font-size:11px;
          font-weight:700;
          font-family:Arial,sans-serif;
          box-sizing:border-box;
        "
      >
        ${count}
      </div>
    `,

    className: "",

    iconSize: [size, size],

    iconAnchor: [size / 2, size / 2],
  });
}

/* ============================================================
   FIT MAP TO EVENTS
============================================================ */

function FitMapToEvents({ events }: { events: ThermalEvent[] }) {
  const map = useMap();

  useEffect(() => {
    if (!events.length) {
      return;
    }
    const validEvents = events.filter((event) =>
      isValidCoordinate(event.latitude, event.longitude),
    );

    if (!validEvents.length) {
      return;
    }
    const bounds = L.latLngBounds(
      validEvents.map((event) => [event.latitude, event.longitude]),
    );

    map.fitBounds(bounds, {
      padding: [30, 30],
      maxZoom: 11,
      animate: false,
    });
  }, [map, events]);

  return null;
}

/* ============================================================
   MAP FOCUS
============================================================ */

function MapFocus({
  events,
  selectedEvent,
}: {
  events: ThermalEvent[];
  selectedEvent: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      selectedEvent !== null &&
      events[selectedEvent] &&
      isValidCoordinate(
        events[selectedEvent].latitude,
        events[selectedEvent].longitude,
      )
    ) {
      const event = events[selectedEvent];

      map.flyTo([event.latitude, event.longitude], 12, {
        duration: 0.8,
      });
    }
  }, [map, events, selectedEvent]);

  return null;
}
/* ============================================================
   REGIONAL INTELLIGENCE GRID
============================================================ */

function RegionalIntelligenceLayer({
  regions,
  selectedRegion,
  onSelectRegion,
}: {
  regions: RegionalHotspot[];
  selectedRegion: RegionalHotspot | null;
  onSelectRegion: (region: RegionalHotspot) => void;
}) {
  const map = useMap();

  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => {
      setZoom(map.getZoom());
    };

    map.on("zoomend", handleZoom);

    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map]);

  const CELL_SIZE = 0.02;

  /*
   * Regional layer hierarchy:
   *
   * Zoom <= 9   → strong regional visibility
   * Zoom 10-11  → moderate visibility
   * Zoom 12     → subtle visibility
   * Zoom >= 13  → hidden
   */

  let fillOpacity = 0.12;
  let borderOpacity = 0.24;

  if (zoom >= 13) {
    fillOpacity = 0;
    borderOpacity = 0;
  } else if (zoom === 12) {
    fillOpacity = 0.04;
    borderOpacity = 0.12;
  } else if (zoom >= 10) {
    fillOpacity = 0.07;
    borderOpacity = 0.16;
  }

  return (
    <>
      {regions.map((region, index) => {
        const color = getRiskColor(region.risk_level);

        const bounds: [[number, number], [number, number]] = [
          [region.latitude - CELL_SIZE / 2, region.longitude - CELL_SIZE / 2],
          [region.latitude + CELL_SIZE / 2, region.longitude + CELL_SIZE / 2],
        ];

        return (
          <Rectangle
            key={`regional-${region.latitude}-${region.longitude}-${index}`}
            bounds={bounds}
            pathOptions={{
              color,
              weight:
                selectedRegion?.latitude === region.latitude &&
                selectedRegion?.longitude === region.longitude
                  ? 3
                  : 1,
              opacity:
                selectedRegion?.latitude === region.latitude &&
                selectedRegion?.longitude === region.longitude
                  ? 0.9
                  : borderOpacity,
              fillColor: color,
              fillOpacity:
                selectedRegion?.latitude === region.latitude &&
                selectedRegion?.longitude === region.longitude
                  ? Math.min(fillOpacity + 0.12, 0.35)
                  : fillOpacity,
            }}
            eventHandlers={{
              click: () => {
                
                onSelectRegion(region);
              },
            }}
          >
            <Popup>
              <div className="min-w-[250px] text-sm">
                <div className="text-base font-semibold">
                  THERMOS Regional Intelligence
                </div>

                <div className="mt-1 text-xs font-semibold" style={{ color }}>
                  {region.risk_level} RISK REGION
                </div>

                <div className="my-3 border-t border-gray-300" />

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span>Thermal Events</span>
                    <strong>{region.event_count}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Critical Events</span>
                    <strong>{region.critical_events}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>High-Risk Events</span>
                    <strong>{region.high_events}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Maximum Risk</span>
                    <strong>{safeFixed(region.max_risk, 1)} / 100</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Average Risk</span>
                    <strong>{safeFixed(region.average_risk, 1)} / 100</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Total FRP</span>
                    <strong>{safeFixed(region.total_frp, 2)}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Max Persistence</span>
                    <strong>{safeFixed(region.max_persistence, 0)} days</strong>
                  </div>
                  <div className="my-3 border-t border-gray-300" />

                  <div className="text-xs font-semibold text-gray-700">
                    Regional Indicators
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between">
                      <span>High Thermal Activity</span>
                      <strong>{region.high_thermal_events}</strong>
                    </div>

                    <div className="flex justify-between">
                      <span>Persistent Activity</span>
                      <strong>{region.persistent_events}</strong>
                    </div>

                    <div className="flex justify-between">
                      <span>Industrial Proximity</span>
                      <strong>{region.industrial_proximity_events}</strong>
                    </div>
                  </div>
                </div>

                <div className="my-3 border-t border-gray-300" />

                <div className="text-xs text-gray-600">
                  Regional risk is derived from the highest-risk thermal
                  activity detected within this analysis cell.
                </div>
              </div>
            </Popup>
          </Rectangle>
        );
      })}
    </>
  );
}
/* ============================================================
   MAP ZOOM CONTROLLER
============================================================ */

function MapZoomLevel({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    onZoomChange(map.getZoom());

    map.on("zoomend", handleZoom);

    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}
/* ============================================================
   VISIBLE EVENT COUNTER
============================================================ */

function VisibleEventCounter({ events }: { events: ThermalEvent[] }) {
  const map = useMap();
  const [visibleCount, setVisibleCount] = useState(events.length);

  useEffect(() => {
    const updateVisibleCount = () => {
      const bounds = map.getBounds();

      const count = events.filter(
        (event) =>
          isValidCoordinate(event.latitude, event.longitude) &&
          bounds.contains([event.latitude, event.longitude]),
      ).length;

      setVisibleCount(count);
    };

    updateVisibleCount();

    map.on("moveend", updateVisibleCount);
    map.on("zoomend", updateVisibleCount);

    return () => {
      map.off("moveend", updateVisibleCount);
      map.off("zoomend", updateVisibleCount);
    };
  }, [map, events]);

  return (
    <div
      className="
        absolute
        bottom-4
        right-4
        z-[1000]
        rounded-lg
        border
        border-white/10
        bg-black/65
        px-3
        py-2
        text-[11px]
        text-white/70
        backdrop-blur
      "
    >
      Showing <span className="font-semibold text-white">{visibleCount}</span>{" "}
      of <span className="font-semibold text-white">{events.length}</span>{" "}
      thermal events
    </div>
  );
}
/* ============================================================
   THERMAL MAP
============================================================ */

export default function ThermalMap({
  events,
  selectedEvent,
  selectedRegion,
  onSelectEvent,
  onSelectRegion,
  regionalHotspots,
}: ThermalMapProps) {
  const [mapZoom, setMapZoom] = useState(10);
  /*
   * Keep original indexes while sorting by risk.
   */

  const sortedEvents = useMemo(() => {
    return events
      .map((event, index) => ({
        event,
        originalIndex: index,
      }))
      .sort((a, b) => (b.event.risk_score ?? 0) - (a.event.risk_score ?? 0));
  }, [events]);

  return (
    <MapContainer
      center={[20.95, 85.12]}
      zoom={10}
      minZoom={5}
      maxZoom={18}
      scrollWheelZoom={true}
      preferCanvas={true}
      className="h-full w-full"
    >
      <MapZoomLevel onZoomChange={setMapZoom} />
      {/* ======================================================
          BASE MAP
      ====================================================== */}

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="thermos-tiles"
      />

      {/* ======================================================
          MAP CONTROLLERS
      ====================================================== */}

      <FitMapToEvents events={events} />

      <MapFocus events={events} selectedEvent={selectedEvent} />
      {/* ======================================================
    REGIONAL INTELLIGENCE
====================================================== */}

      <RegionalIntelligenceLayer
        regions={regionalHotspots}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
      />
      {/* ======================================================
          CLUSTER OVERLAY
          
          These markers are intentionally invisible.

          Their ONLY purpose is to let Leaflet calculate
          density and render a subtle cluster indicator.
      ====================================================== */}
      {mapZoom >= 12 && (
        <MarkerClusterGroup
          chunkedLoading
          chunkInterval={100}
          chunkDelay={25}
          maxClusterRadius={55}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={false}
          zoomToBoundsOnClick={false}
          removeOutsideVisibleBounds={true}
          animate={false}
          animateAddingMarkers={false}
          iconCreateFunction={createClusterIcon}
        >
          {mapZoom >= 12 &&
            sortedEvents.map(({ event, originalIndex }) => {
              if (!isValidCoordinate(event.latitude, event.longitude)) {
                return null;
              }

              return (
                <CircleMarker
                  key={`cluster-${event.latitude}-${event.longitude}-${originalIndex}`}
                  center={[event.latitude, event.longitude]}
                  radius={1}
                  pathOptions={{
                    opacity: 0,
                    fillOpacity: 0,
                    weight: 0,
                  }}
                  ref={(marker) => {
                    if (marker) {
                      (marker.options as any).thermosRiskLevel =
                        event.risk_level;

                      (marker.options as any).thermosRiskScore =
                        event.risk_score;
                    }
                  }}
                />
              );
            })}
        </MarkerClusterGroup>
      )}
      {/* ======================================================
          ACTUAL THERMAL EVENTS
          
          ALL 370 detections stay visible.
          
          These are the primary map visualization.
      ====================================================== */}

      {sortedEvents.map(({ event, originalIndex }) => {
        if (!isValidCoordinate(event.latitude, event.longitude)) {
          return null;
        }
        const color = getRiskColor(event.risk_level);

        const isSelected = selectedEvent === originalIndex;

        return (
          <CircleMarker
            key={`event-${event.latitude}-${event.longitude}-${originalIndex}`}
            center={[event.latitude, event.longitude]}
            radius={isSelected ? 7 : 4}
            pathOptions={{
              color: isSelected ? "#ffffff" : color,
              fillColor: color,
              fillOpacity: isSelected ? 1 : 0.95,
              weight: isSelected ? 2.5 : 1.5,
            }}
            eventHandlers={{
              click: () => {
                onSelectEvent(originalIndex);
              },
            }}
          >
            <Popup>
              <div className="min-w-[240px] text-sm">
                <strong>THERMOS Thermal Event</strong>

                <div className="mt-3 space-y-1">
                  <div>
                    <strong>Latitude:</strong> {safeFixed(event.latitude, 5)}
                  </div>

                  <div>
                    <strong>Longitude:</strong> {safeFixed(event.longitude, 5)}
                  </div>

                  <div>
                    <strong>Date:</strong> {event.acq_date}
                  </div>

                  <div>
                    <strong>FRP:</strong> {safeFixed(event.frp, 2)}
                  </div>

                  <div>
                    <strong>FIRMS Confidence:</strong> {event.confidence}
                  </div>

                  <div>
                    <strong>Day/Night:</strong> {event.daynight}
                  </div>
                </div>

                <div className="my-3 border-t border-gray-300" />

                <strong>THERMOS AI Intelligence</strong>

                <div className="mt-2 space-y-1">
                  <div>
                    <strong>Classification:</strong> {event.classification}
                  </div>

                  <div>
                    <strong>AI Confidence:</strong>{" "}
                    {safeFixed(event.ai_confidence, 1)}%
                  </div>

                  <div>
                    <strong>Risk Score:</strong>{" "}
                    {safeFixed(event.risk_score, 1)} / 100
                  </div>

                  <div>
                    <strong>Risk Level:</strong> {event.risk_level}
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* ======================================================
          MAP STATUS
      ====================================================== */}

      <VisibleEventCounter events={events} />
    </MapContainer>
  );
}
