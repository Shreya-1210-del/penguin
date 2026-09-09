// data/stations.js — Antarctic Research Station Registry
// Indian Antarctic Programme (NCPOR / MoES)

export const STATIONS = {
  BHARATI: {
    id: "BHARATI",
    name: "BHARATI",
    fullName: "Bharati Antarctic Research Station",
    location: "Larsemann Hills, East Antarctica",
    latitude: -69.4072,
    longitude: 76.1872,
    elevationMeters: 35,
    timezone: "Antarctica/Mawson",
    coords: "69°24′ S / 76°11′ E",
    image: "https://www.ncpor.res.in/files/images/Bharati%20%282%29.jpg",
    fallback: "/assets/antarctic-mountain-design.jpg",
    commissioned: 2012,
    distanceFromMaitriKm: 3496,
  },
  MAITRI: {
    id: "MAITRI",
    name: "MAITRI",
    fullName: "Maitri Antarctic Research Station",
    location: "Schirmacher Oasis, Queen Maud Land",
    latitude: -70.7661,
    longitude: 11.7322,
    elevationMeters: 117,
    timezone: "Antarctica/Troll",
    coords: "70°45′ S / 11°44′ E",
    image: "https://ncps.ncpor.res.in/expedition/image/Maitri.JPG",
    fallback: "/assets/antarctic-mountain-design.jpg",
    commissioned: 1989,
    distanceFromBharatiKm: 3496,
  },
};

export const DEFAULT_STATION_ID = "BHARATI";

export const STATION_LIST = Object.values(STATIONS);

/**
 * Resolves station data by station ID or key (case-insensitive).
 * Falls back to DEFAULT_STATION_ID if not found.
 */
export function getStation(stationId = DEFAULT_STATION_ID) {
  if (!stationId) return STATIONS[DEFAULT_STATION_ID];
  const key = String(stationId).trim().toUpperCase();
  return STATIONS[key] || STATIONS[DEFAULT_STATION_ID];
}

export default STATIONS;
