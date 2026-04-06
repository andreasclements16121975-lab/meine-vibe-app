function initAutocomplete() {
const input = document.getElementById('eventOpponent');
if (!input) return;

const autocomplete = new google.maps.places.Autocomplete(input, {
types: ['establishment'],
componentRestrictions: { country: 'de' }
});

autocomplete.addListener('place_changed', () => {
const place = autocomplete.getPlace();
console.log('Ausgewählter Gegner:', place.name, place.formatted_address);
input.value = place.name || '';
});
}
