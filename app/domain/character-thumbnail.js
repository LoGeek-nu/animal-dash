// Version the URL when changing dimensions/quality; original image URLs stay intact.
export function characterThumbnailUrl(id) {
  return `/api/characters/${encodeURIComponent(id)}/thumbnail/v1`;
}

export function characterThumbnailKey(id) {
  return `thumbnails/v1/${id}.webp`;
}
