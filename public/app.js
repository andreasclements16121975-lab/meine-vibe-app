function initAutocomplete() {
  const input = document.getElementById('eventOpponent');
  if (input) {
    new google.maps.places.Autocomplete(input, { types: ['establishment', 'geocode'] });
  }
}
