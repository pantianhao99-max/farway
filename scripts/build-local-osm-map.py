"""Build Faraway's compact offline basemap from a Geofabrik/OpenStreetMap PBF.

Usage: python scripts/build-local-osm-map.py INPUT.osm.pbf OUTPUT.json
The output intentionally contains only the MacLehose corridor and a small set of
visual layers; it is a generated artifact, not a general-purpose map extract.
"""
import json, math, sys
from pathlib import Path
import osmium

ROOT=Path(__file__).resolve().parents[1]
route_document=json.loads((ROOT/'src/data/worlds/maclehose-route.json').read_text(encoding='utf-8'))

def all_route_points():
    points=[]
    for feature in route_document['data']['features']:
        geometry=feature['geometry']
        lines=[geometry['coordinates']] if geometry['type']=='LineString' else geometry['coordinates']
        for line in lines: points.extend(line[::max(1,len(line)//80)])
    return points

ROUTE=all_route_points()
BOUNDS=(113.95,22.30,114.41,22.50)

def in_bounds(lon,lat): return BOUNDS[0]<=lon<=BOUNDS[2] and BOUNDS[1]<=lat<=BOUNDS[3]
def near_route(lon,lat,threshold=.025):
    scale=math.cos(math.radians(lat))
    return min(((lon-x)*scale)**2+(lat-y)**2 for x,y in ROUTE) <= threshold**2

def perpendicular_distance(p,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1]
    if dx==dy==0:return math.hypot(p[0]-a[0],p[1]-a[1])
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy))

def simplify(points,tolerance=.00006):
    if len(points)<3:return points
    best,index=0,0
    for i in range(1,len(points)-1):
        distance=perpendicular_distance(points[i],points[0],points[-1])
        if distance>best:best,index=distance,i
    if best<=tolerance:return [points[0],points[-1]]
    return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)

class CompactMap(osmium.SimpleHandler):
    def __init__(self):
        super().__init__();self.features=[];self.geojson_factory=osmium.geom.GeoJSONFactory()

    def add(self,geometry,layer,**properties):
        props={'layer':layer};props.update({k:v for k,v in properties.items() if v not in (None,'')})
        self.features.append({'type':'Feature','properties':props,'geometry':geometry})

    def node(self,node):
        if not node.location.valid() or not in_bounds(node.location.lon,node.location.lat):return
        tags=node.tags
        if tags.get('place') in ('city','town','suburb','village','hamlet','quarter','neighbourhood','isolated_dwelling','farm') or tags.get('tourism')=='viewpoint' or tags.get('natural')=='peak':
            self.add({'type':'Point','coordinates':[round(node.location.lon,6),round(node.location.lat,6)]},'place',name=tags.get('name:zh') or tags.get('name') or tags.get('name:en'),kind=tags.get('place') or tags.get('natural') or tags.get('tourism'),population=tags.get('population'),ele=tags.get('ele'))

    def way(self,way):
        try: points=[[node.lon,node.lat] for node in way.nodes]
        except osmium.InvalidLocationError:return
        if len(points)<2:return
        center=points[len(points)//2]
        if not in_bounds(*center):return
        tags=way.tags;highway=tags.get('highway');natural=tags.get('natural');landuse=tags.get('landuse')
        name=tags.get('name:zh') or tags.get('name') or tags.get('name:en')
        major=highway in ('motorway','trunk','primary','secondary','tertiary')
        neighbourhood=highway in ('unclassified','residential','service','living_street') and near_route(*center,.032)
        # Keep trails throughout the same local-map corridor as land cover.
        # The former ~2 km route-only cutoff produced spatial holes that no
        # MapLibre style or zoom rule could recover.
        trail=highway in ('track','path','footway','steps','pedestrian','cycleway') and near_route(*center,.075)
        local=neighbourhood or trail
        if major or local:
            self.add({'type':'LineString','coordinates':simplify(points)},'road',kind=highway,name=name,
                     bridge=tags.get('bridge'),tunnel=tags.get('tunnel'),access=tags.get('access'),
                     surface=tags.get('surface'),tracktype=tags.get('tracktype'),service=tags.get('service'),
                     layer_order=tags.get('layer'),oneway=tags.get('oneway'))
        elif tags.get('railway') in ('rail','light_rail','subway'):
            self.add({'type':'LineString','coordinates':simplify(points)},'railway',kind=tags.get('railway'),name=name,
                     bridge=tags.get('bridge'),tunnel=tags.get('tunnel'),service=tags.get('service'),
                     preserved=tags.get('preserved'),layer_order=tags.get('layer'))
        elif tags.get('boundary')=='administrative' and tags.get('admin_level') in ('4','5','6','7','8'):
            self.add({'type':'LineString','coordinates':simplify(points,.00012)},'boundary',kind=tags.get('admin_level'),name=name)
        elif (tags.get('waterway') and near_route(*center,.04)) or natural=='coastline':
            self.add({'type':'LineString','coordinates':simplify(points)},'waterway',kind=tags.get('waterway') or natural,name=name)

    def area(self,area):
        tags=area.tags;natural=tags.get('natural');landuse=tags.get('landuse');leisure=tags.get('leisure');amenity=tags.get('amenity');tourism=tags.get('tourism')
        kind=natural or landuse or leisure or amenity or tourism
        supported=natural in ('water','wood','wetland','scrub','heath','grassland','bare_rock','sand','beach') or landuse in ('reservoir','forest','grass','meadow','residential','industrial','commercial','retail','cemetery','farmland','orchard','quarry','recreation_ground') or leisure in ('park','nature_reserve','golf_course','pitch','sports_centre','playground') or amenity in ('school','university','hospital','parking','place_of_worship') or tourism in ('attraction','zoo') or bool(tags.get('building'))
        if not supported:return
        try:
            geometry=json.loads(self.geojson_factory.create_multipolygon(area))
            def flatten(value):
                if isinstance(value,list) and len(value)>=2 and isinstance(value[0],(int,float)):return [value]
                points=[]
                if isinstance(value,list):
                    for child in value:points.extend(flatten(child))
                return points
            points=flatten(geometry.get('coordinates',[]))
            if not points:return
            samples=points[::max(1,len(points)//24)]
            if not any(in_bounds(*point) for point in samples):return
            # Landcover must remain complete across the advertised offline map
            # bounds. Corridor-clipping forests/scrub caused their patterns to
            # disappear simply by panning away from the trail. Only buildings
            # retain the compact route-local cutoff for file-size control.
            if tags.get('building') and not any(near_route(*point,.012) for point in samples):return
            self.add(geometry,'building' if tags.get('building') else 'area',kind='building' if tags.get('building') else kind,name=tags.get('name:zh') or tags.get('name') or tags.get('name:en'),landcover=tags.get('landcover'),leaf_type=tags.get('leaf_type'),wetland=tags.get('wetland'),surface=tags.get('surface'),religion=tags.get('religion'))
        except (RuntimeError,ValueError,TypeError):return

if len(sys.argv)!=3:raise SystemExit('usage: build-local-osm-map.py INPUT.osm.pbf OUTPUT.json')
handler=CompactMap();handler.apply_file(sys.argv[1],locations=True,idx='flex_mem')
output=Path(sys.argv[2]);output.parent.mkdir(parents=True,exist_ok=True)
document={'type':'FeatureCollection','attribution':'© OpenStreetMap contributors','features':handler.features}
output.write_text(json.dumps(document,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
print(f'wrote {len(handler.features)} features, {output.stat().st_size/1024/1024:.1f} MB')
