// OpenStreetMap Carto palette, adapted for Faraway's compact offline GeoJSON.
// Keep upstream-inspired visual tokens here so the map component has no ad-hoc colours.
export const OSM_CARTO={
  background:{land:'#f2efe9',water:'#aad3df'},
  landuse:{
    residential:'#e0dfdf',industrial:'#ebdbe8',commercial:'#f2dad9',retail:'#ffd6d1',
    farmland:'#eef0d5',orchard:'#aedfa3',quarry:'#c5c3c3',cemetery:'#aacbaf',
    forest:'#add19e',grass:'#cdebb0',scrub:'#c8d7ab',heath:'#d6d99f',park:'#c8facc',
    wetland:'#b5d8c7',rock:'#d5d0c5',sand:'#f5e9c6',pitch:'#aae0cb'
  },
  building:{fill:'#d9d0c9',lowZoomFill:'#d1c6bd',outline:'#b9a99c',fillOpacity:1,outlineOpacity:1,outlineWidth:.75,minZoom:14,outlineMinZoom:15},
  water:{fill:'#aad3df',line:'#aad3df'},
  road:{
    motorway:{fill:'#e892a2',casing:'#dc2a67'},trunk:{fill:'#f9b29c',casing:'#c84e2f'},
    primary:{fill:'#fcd6a4',casing:'#a06b00'},secondary:{fill:'#f7fabf',casing:'#707d05'},
    tertiary:{fill:'#ffffff',casing:'#8f8f8f'},minor:{fill:'#ffffff',casing:'#bbbbbb'},
    livingStreet:{fill:'#ededed',casing:'#bbbbbb'},pedestrian:{fill:'#dddde8',casing:'#999999'},
    footway:'#fa8072',cycleway:'#0000ff',track:'#996600',pathCasing:'#ffffff',
    footwayOpacity:1,pathCasingOpacity:.4,trackOpacity:.8,pathCasingPadding:2
  },
  railway:{casing:'#777777',fill:'#ffffff'},
  boundary:'#9e8b9e',
  opacity:{base:1,boundary:.8,railway:1},
  text:{
    place:'#222222',placeLight:'#777777',peak:'#6e441e',halo:'#ffffff',haloOpacity:.6,
    standardHalo:'rgba(255,255,255,0.6)',opaqueHalo:'#ffffff',
    fontFamily:['Noto Sans CJK SC','Noto Sans SC','Noto Sans','Arial Unicode MS'],
    peakSize:10,peakOffsetEm:.7,peakMaxWidthEm:3,peakLineHeight:.85,
    haloRadius:1,placeHaloRadius:1.5,placeMargin:7
  }
} as const

// Mapnik/OSM raster zoom 0 is a 256 px world; MapLibre zoom 0 is 512 px.
// Subtracting one keeps the same ground resolution and on-screen feature size.
export const OSM_CARTO_ZOOM_OFFSET=1
