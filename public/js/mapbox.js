export const displayMap = (locations) => {
  //!you need to revise that
  mapboxgl.accessToken =
    'pk.eyJ1IjoiYWJvdWxhem0xOTk3IiwiYSI6ImNsb3ZvOGVybzBkcmsycXBiaGlwbWViejUifQ.FQ4wj7C3vOVEjxacAN09kQ';

  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/aboulazm1997/clprmq962016w01p99ber577n',
    scrollZoom: false,
    // center: [-118.113491, 34.111745],
    // zoom: 10,
    // interactive: false
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create marker
    const el = document.createElement('div');
    el.className = 'marker';

    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
