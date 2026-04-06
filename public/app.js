function initAutocomplete() {
  const opponentInput = document.getElementById('eventOpponent');
  const addressInput = document.getElementById('eventAddress');

  if (!opponentInput) return;

  const autocomplete = new google.maps.places.Autocomplete(opponentInput, {
    types: ['establishment', 'geocode'],
    componentRestrictions: { country: 'de' }
  });

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();

    if (!place || !place.geometry) {
      return;
    }

    opponentInput.value = place.name || '';

    if (addressInput) {
      addressInput.value = place.formatted_address || '';
    }

    console.log('Ausgewählt:', place.name, place.formatted_address);
  });
}

window.initAutocomplete = initAutocomplete;
