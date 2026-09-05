import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Search, Navigation, Loader2, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/find/hospitals")({
  head: () => ({
    meta: [{ title: "Find care — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: FindHospitals,
});

const CATEGORIES = [
  { key: "hospitals", fallback: "Hospitals", query: "hospital" },
  { key: "pharmacies", fallback: "Pharmacies", query: "pharmacy" },
  { key: "urgentCare", fallback: "Urgent care", query: "urgent care" },
  { key: "dentists", fallback: "Dentists", query: "dentist" },
  { key: "labs", fallback: "Labs", query: "medical laboratory" },
  { key: "imaging", fallback: "Imaging", query: "radiology imaging" },
];

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Minimal typings for the Google Maps JS API surface we use.
// (The full @types/google.maps package is not installed in this project.)
type GoogleLatLng = { lat(): number; lng(): number };

type GooglePlace = {
  name: string;
  vicinity?: string;
  place_id?: string;
  geometry: { location: GoogleLatLng };
};

type GoogleMap = {
  setCenter(center: { lat: number; lng: number }): void;
};

type GoogleMarker = {
  setMap(map: GoogleMap | null): void;
  addListener(event: string, handler: () => void): void;
};

type GoogleDirectionsResult = { routes: unknown[] };

type GoogleDirectionsRenderer = {
  setMap(map: GoogleMap | null): void;
  setDirections(result: GoogleDirectionsResult): void;
};

type GooglePlaceService = {
  nearbySearch(
    request: unknown,
    callback: (results: GooglePlace[] | null, status: string) => void,
  ): void;
};

type GoogleDirectionsService = {
  route(
    request: unknown,
    callback: (result: GoogleDirectionsResult | null, status: string) => void,
  ): void;
};

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: {
    position: unknown;
    map: GoogleMap | null;
    title?: string;
    icon?: unknown;
  }) => GoogleMarker;
  SymbolPath: { CIRCLE: number };
  places: {
    PlacesService: new (map: GoogleMap) => GooglePlaceService;
    PlacesServiceStatus: { OK: string };
  };
  DirectionsRenderer: new (options: Record<string, unknown>) => GoogleDirectionsRenderer;
  DirectionsService: new () => GoogleDirectionsService;
  TravelMode: { DRIVING: string };
};

type GoogleMapsApi = { maps: GoogleMapsNamespace };

type SomaWindow = {
  google?: GoogleMapsApi;
  __somaInitMap?: () => void;
};

function getGoogle(): GoogleMapsApi | undefined {
  return (window as SomaWindow).google;
}

// Module-level singleton so navigating away/back doesn't re-add the script.
let mapsPromise: Promise<GoogleMapsApi> | null = null;
function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (getGoogle()?.maps) return Promise.resolve(getGoogle()!);
  if (mapsPromise) return mapsPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps key not configured"));

  mapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    (window as SomaWindow).__somaInitMap = () => resolve(getGoogle()!);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&libraries=places&loading=async&callback=__somaInitMap`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function FindHospitals() {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string>("hospital");
  const [selected, setSelected] = useState<{
    name: string;
    address?: string;
    lat: number;
    lng: number;
    placeId?: string;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const routeDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const routeMapRef = useRef<GoogleMap | null>(null);
  const directionsRendererRef = useRef<GoogleDirectionsRenderer | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const runSearch = useCallback(
    (q: string) => {
      if (!coords || !mapRef.current) return;
      const google = getGoogle();
      if (!google) return;
      const service = new google.maps.places.PlacesService(mapRef.current);
      service.nearbySearch(
        {
          location: coords,
          radius: 5000,
          keyword: q,
        },
        (results: GooglePlace[] | null, status: string) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;
          markersRef.current.forEach((m) => m.setMap(null));
          markersRef.current = [];
          results.slice(0, 20).forEach((place) => {
            const marker = new google.maps.Marker({
              map: mapRef.current,
              position: place.geometry.location,
              title: place.name,
            });
            marker.addListener("click", () => {
              setSelected({
                name: place.name,
                address: place.vicinity,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                placeId: place.place_id,
              });
            });
            markersRef.current.push(marker);
          });
        },
      );
    },
    [coords],
  );

  // Initialize the discovery map once coords + google are ready
  useEffect(() => {
    if (!coords || !mapDivRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapDivRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapDivRef.current, {
            center: coords,
            zoom: 13,
            disableDefaultUI: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          new google.maps.Marker({
            position: coords,
            map: mapRef.current,
            title: t("findCare.you", "You"),
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#3b82f6",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
        } else {
          mapRef.current.setCenter(coords);
        }
        runSearch(activeQuery);
      })
      .catch((e) => setMapError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  // Re-search when category/query changes
  useEffect(() => {
    if (mapRef.current && coords) runSearch(activeQuery);
  }, [activeQuery, runSearch, coords]);

  // Route map: renders directions from coords → selected
  useEffect(() => {
    if (!selected || !coords || !routeDivRef.current) return;
    loadGoogleMaps().then((google) => {
      if (!routeMapRef.current) {
        routeMapRef.current = new google.maps.Map(routeDivRef.current!, {
          center: selected,
          zoom: 14,
          disableDefaultUI: true,
        });
      }
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: routeMapRef.current,
          suppressMarkers: false,
          polylineOptions: { strokeColor: "#3b82f6", strokeWeight: 5 },
        });
      } else {
        directionsRendererRef.current.setMap(routeMapRef.current);
      }
      const svc = new google.maps.DirectionsService();
      svc.route(
        {
          origin: coords,
          destination: { lat: selected.lat, lng: selected.lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (res: GoogleDirectionsResult | null, status: string) => {
          if (status === "OK" && res && directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(res);
          }
        },
      );
    });
  }, [selected, coords]);

  const mapsExternalUrl = (q: string) => {
    const base = "https://www.google.com/maps/search/";
    if (coords) return `${base}${encodeURIComponent(q)}/@${coords.lat},${coords.lng},14z`;
    return `${base}${encodeURIComponent(q)}`;
  };

  return (
    <AppShell
      title={t("findCare.title", "Find care")}
      subtitle={t("findCare.subtitle", "Hospitals, pharmacies & specialists near you")}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) setActiveQuery(query.trim());
            }}
            className="soma-card flex gap-2 p-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  "findCare.searchPlaceholder",
                  "Search for hospitals, cardiologists, pharmacies…",
                )}
                className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" className="soma-gradient soma-glow border-0 text-white">
              {t("findCare.search", "Search")}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.key}
                onClick={() => setActiveQuery(c.query)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeQuery === c.query
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                <MapPin className="mr-1 inline h-3 w-3" />
                {t(`findCare.categories.${c.key}`, c.fallback)}
              </button>
            ))}
          </div>

          {/* DISCOVERY MAP */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
              <span className="font-medium">
                {t("findCare.nearby", "Nearby {{query}}", { query: activeQuery })}
              </span>
              <a
                href={mapsExternalUrl(activeQuery)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {t("findCare.openInGoogleMaps", "Open in Google Maps")}{" "}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative aspect-[16/10] w-full bg-secondary/40">
              {!coords && (
                <div className="absolute inset-0 grid place-items-center text-center text-sm text-muted-foreground">
                  <div>
                    <Navigation className="mx-auto mb-2 h-6 w-6 text-primary" />
                    {t("findCare.shareLocationPrompt", "Share your location to see nearby care.")}
                  </div>
                </div>
              )}
              {mapError && (
                <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-destructive">
                  {mapError}
                </div>
              )}
              <div ref={mapDivRef} className="h-full w-full" />
            </div>
          </Card>

          {/* ROUTE MAP */}
          {selected && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
                <div>
                  <p className="font-semibold text-foreground">{selected.name}</p>
                  {selected.address && <p className="text-muted-foreground">{selected.address}</p>}
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${coords?.lat},${coords?.lng}&destination=${selected.lat},${selected.lng}${
                    selected.placeId ? `&destination_place_id=${selected.placeId}` : ""
                  }&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md soma-gradient px-2.5 py-1.5 text-xs font-medium text-white"
                >
                  {t("findCare.startNavigation", "Start navigation")}{" "}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="aspect-[16/9] w-full">
                <div ref={routeDivRef} className="h-full w-full" />
              </div>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="grid h-10 w-10 place-items-center rounded-xl soma-gradient text-white">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t("findCare.yourLocation", "Your location")}</CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "findCare.yourLocationDescription",
                  "Share your location for accurate maps and directions",
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {coords ? (
              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                <p className="text-muted-foreground">{t("findCare.latLng", "Lat / Lng")}</p>
                <p className="font-mono">
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </p>
              </div>
            ) : (
              <Button onClick={locate} disabled={locating} variant="outline" className="w-full">
                {locating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="mr-2 h-4 w-4" />
                )}
                Use my location
              </Button>
            )}
            <div className="rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground">
              Tap any pin on the map to see driving directions from your location.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
