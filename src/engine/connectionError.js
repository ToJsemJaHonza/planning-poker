export function connectionErrorMessage(error) {
  const details = `${error?.code || ''} ${error?.message || ''}`;
  if (/permission[ _-]denied/i.test(details)) {
    return 'Room access was denied by the server. Please contact the app owner.';
  }
  return 'Could not connect to this room. Check your connection and try again.';
}
