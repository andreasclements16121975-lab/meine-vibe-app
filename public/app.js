function initAutocomplete() {
const opponentInput = document.getElementById('eventOpponent');
const addressInput = document.getElementById('eventAddress');

if (!opponentInput) return;

const autocomplete = new google.maps.places.Autocomplete(opponentInput, {
types: ['establishment', 'geocode'],
componentRestrictions: { country: 'de' }
});
