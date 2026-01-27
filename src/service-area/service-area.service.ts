import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

type GeoJSONMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

type GeoJSON = GeoJSONPolygon | GeoJSONMultiPolygon;

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isLngLatPair(p: any): p is [number, number] {
  return Array.isArray(p) && p.length >= 2 && isFiniteNumber(p[0]) && isFiniteNumber(p[1]);
}

function pointInRing(point: [number, number], ring: number[][]) {
  const x = point[0];
  const y = point[1];

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: [number, number], polygon: GeoJSONPolygon) {
  const rings = polygon.coordinates;
  if (!rings?.length) return false;
  const outer = rings[0];
  if (!pointInRing(point, outer)) return false;

  // Holes
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

function validateGeoJSON(geo: any): GeoJSON {
  if (!geo || typeof geo !== 'object') {
    throw new BadRequestException('Invalid geojson');
  }
  const t = String((geo as any).type || '');
  if (t !== 'Polygon' && t !== 'MultiPolygon') {
    throw new BadRequestException('GeoJSON must be Polygon or MultiPolygon');
  }

  if (t === 'Polygon') {
    const coords = (geo as any).coordinates;
    if (!Array.isArray(coords) || coords.length === 0) {
      throw new BadRequestException('Polygon coordinates missing');
    }
    for (const ring of coords) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new BadRequestException('Invalid polygon ring');
      }
      for (const p of ring) {
        if (!isLngLatPair(p)) throw new BadRequestException('Invalid coordinate pair');
      }
    }
    return geo as GeoJSONPolygon;
  }

  const coords = (geo as any).coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    throw new BadRequestException('MultiPolygon coordinates missing');
  }
  for (const poly of coords) {
    if (!Array.isArray(poly) || poly.length === 0) {
      throw new BadRequestException('Invalid multipolygon');
    }
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new BadRequestException('Invalid polygon ring');
      }
      for (const p of ring) {
        if (!isLngLatPair(p)) throw new BadRequestException('Invalid coordinate pair');
      }
    }
  }
  return geo as GeoJSONMultiPolygon;
}

@Injectable()
export class ServiceAreaService {
  constructor(private prisma: PrismaService) {}

  async listZones() {
    return (this.prisma as any).serviceZone.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async createZone(data: { name: string; geojson: any; active?: boolean }) {
    const geojson = validateGeoJSON(data.geojson);
    return (this.prisma as any).serviceZone.create({
      data: {
        name: data.name,
        geojson: geojson as any,
        active: data.active ?? true,
      },
    });
  }

  async updateZone(
    id: number,
    data: { name?: string; geojson?: any; active?: boolean },
  ) {
    const patch: any = {};
    if (typeof data.name === 'string') patch.name = data.name;
    if (typeof data.active === 'boolean') patch.active = data.active;
    if (data.geojson != null) patch.geojson = validateGeoJSON(data.geojson) as any;

    return (this.prisma as any).serviceZone.update({
      where: { id },
      data: patch,
    });
  }

  async deleteZone(id: number) {
    await (this.prisma as any).serviceZone.delete({ where: { id } });
    return { ok: true };
  }

  async isPointServiced(lat: number, lng: number) {
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return false;
    const zones = await (this.prisma as any).serviceZone.findMany({
      where: { active: true },
      select: { geojson: true },
      take: 200,
    });

    const point: [number, number] = [lng, lat];
    for (const z of zones as any[]) {
      const geo = z.geojson as any;
      try {
        const g = validateGeoJSON(geo);
        if (g.type === 'Polygon') {
          if (pointInPolygon(point, g)) return true;
        } else {
          for (const polyCoords of g.coordinates) {
            const poly: GeoJSONPolygon = { type: 'Polygon', coordinates: polyCoords };
            if (pointInPolygon(point, poly)) return true;
          }
        }
      } catch {
        // skip invalid stored shapes
      }
    }
    return false;
  }

  async assertPointServiced(lat: number | null | undefined, lng: number | null | undefined) {
    if (lat == null || lng == null) {
      throw new BadRequestException(
        'Delivery location not set. Please allow location or set it in your account profile.',
      );
    }
    const ok = await this.isPointServiced(Number(lat), Number(lng));
    if (!ok) {
      throw new BadRequestException(
        'Sorry, we are not available in your area yet.',
      );
    }
    return true;
  }
}
