import os
import geopandas as gpd

from app.data.thermal_features import add_thermal_features


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

OSM_DIR = os.path.join(
    os.path.dirname(__file__),
    "osm"
)


def add_spatial_features():
    firms = add_thermal_features().copy()

    # Convert FIRMS events to GeoDataFrame
    firms_gdf = gpd.GeoDataFrame(
        firms,
        geometry=gpd.points_from_xy(
            firms["longitude"],
            firms["latitude"]
        ),
        crs="EPSG:4326"
    )

    # Project to UTM Zone 44N for distance calculations
    firms_gdf = firms_gdf.to_crs("EPSG:32644")

    # Load OSM layers
    industrial = gpd.read_file(
        os.path.join(OSM_DIR, "industrial.geojson")
    ).to_crs("EPSG:32644")

    roads = gpd.read_file(
        os.path.join(OSM_DIR, "roads.geojson")
    ).to_crs("EPSG:32644")

    settlements = gpd.read_file(
        os.path.join(OSM_DIR, "settlements.geojson")
    ).to_crs("EPSG:32644")

    # Distance to nearest industrial area
    firms_gdf["distance_to_industry_km"] = (
        firms_gdf.geometry.apply(
            lambda point: industrial.geometry.distance(point).min()
        ) / 1000
    )

    # Distance to nearest road
    firms_gdf["distance_to_road_km"] = (
        firms_gdf.geometry.apply(
            lambda point: roads.geometry.distance(point).min()
        ) / 1000
    )

    # Distance to nearest settlement
    firms_gdf["distance_to_settlement_km"] = (
        firms_gdf.geometry.apply(
            lambda point: settlements.geometry.distance(point).min()
        ) / 1000
    )

    return firms_gdf