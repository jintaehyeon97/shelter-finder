/**
 * 특정 시각·위치의 태양 고도(altitude)와 방위각(azimuth)을 계산합니다.
 * 외부 API 없이 순수 천문 계산으로 구합니다 (SunCalc 알고리즘 기반).
 */

const RAD = Math.PI / 180;
const DAY_MS = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397; // 지구 자전축 기울기

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + Math.PI;
}

function declination(L: number): number {
  return Math.asin(Math.sin(L) * Math.sin(OBLIQUITY));
}

function rightAscension(L: number): number {
  return Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

export interface SolarPosition {
  altitudeDeg: number; // 태양 고도. 0=지평선, 90=정중앙 머리 위
  azimuthDeg: number; // 방위각. 0=북, 90=동, 180=남, 270=서 (시계방향, 나침반 기준)
}

export function getSolarPosition(date: Date, latitude: number, longitude: number): SolarPosition {
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(date);

  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  );
  const azimuthFromSouth = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  );
  // SunCalc는 남쪽 기준 방위각을 주므로, 북쪽 기준 시계방향(나침반 방식)으로 변환
  const azimuthDeg = ((azimuthFromSouth * 180) / Math.PI + 180 + 360) % 360;

  return {
    altitudeDeg: (altitude * 180) / Math.PI,
    azimuthDeg,
  };
}
