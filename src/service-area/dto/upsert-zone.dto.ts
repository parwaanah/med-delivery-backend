import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertZoneDto {
  @ApiProperty({ example: 'Srinagar - Central' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description:
      'GeoJSON Polygon or MultiPolygon. Coordinates must be [lng, lat].',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [74.79, 34.05],
          [74.89, 34.05],
          [74.89, 34.15],
          [74.79, 34.15],
          [74.79, 34.05],
        ],
      ],
    },
  })
  @IsObject()
  geojson!: any;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

