// OpenStreetMap Carto palette, adapted for Faraway's compact offline GeoJSON.
// Keep upstream-inspired visual tokens here so the map component has no ad-hoc colours.
export const OSM_CARTO={
  background:{land:'#f2efe9',water:'#aad3df'},
  landuse:{
    builtUpLow:'#d0d0d0',builtUpZ12:'#dddddd',
    residential:'#e0dfdf',industrial:'#ebdbe8',commercial:'#f2dad9',retail:'#ffd6d1',
    farmland:'#eef0d5',orchard:'#aedfa3',quarry:'#c5c3c3',cemetery:'#aacbaf',
    forest:'#add19e',grass:'#cdebb0',scrub:'#c8d7ab',heath:'#d6d99f',park:'#c8facc',
    wetland:'#b5d8c7',bareGround:'#eee5dc',sand:'#f5e9c6',beach:'#fff1ba',
    leisure:'#e0fce3',societal:'#ffffe5',parking:'#eeeeee',pitch:'#88e0be'
  },
  building:{fill:'#d9d0c9',lowZoomFill:'#d1c6bd',outline:'#b9a99c',fillOpacity:1,outlineOpacity:1,outlineWidth:.75,minZoom:14,outlineMinZoom:15},
  water:{fill:'#aad3df',line:'#aad3df',text:'#4d80b3'},
  road:{
    motorway:{lowFill:'#e66e89',lowCasing:'#c24e6b',fill:'#e892a2',casing:'#dc2a67'},
    trunk:{lowFill:'#f6967a',lowCasing:'#d1684a',fill:'#f9b29c',casing:'#c84e2f'},
    primary:{lowFill:'#f4c37d',lowCasing:'#c78d2b',fill:'#fcd6a4',casing:'#a06b00'},
    secondary:{lowFill:'#e7ed9d',lowCasing:'#a4b329',fill:'#f7fabf',casing:'#707d05'},
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
    // This name must match the offline glyph directory. CJK glyphs are made
    // locally by MapLibre through localIdeographFontFamily.
    fontFamily:['NotoSansRegular'],
    // Mapnik's text-dy=7 is baseline-based. MapLibre offsets the glyph box;
    // 1em keeps the 1px halo clear of the bottom of the 8px peak marker.
    peakSize:10,peakOffsetEm:.7,peakMaxWidthEm:3,peakShortNameWidthEm:4,peakLineHeight:1.05,
    haloRadius:1,placeHaloRadius:1.5,placeMargin:7
  }
} as const

// Mapnik/OSM raster zoom 0 is a 256 px world; MapLibre zoom 0 is 512 px.
// Subtracting one keeps the same ground resolution and on-screen feature size.
export const OSM_CARTO_ZOOM_OFFSET=1
