export interface SubsonicResponse<T = unknown> {
  'subsonic-response': {
    status: 'ok' | 'failed';
    version: string;
    error?: {
      code: number;
      message: string;
    };
  } & T;
}

export interface Artist {
  id: string;
  name: string;
  coverArt?: string;
  albumCount?: number;
  starred?: string;
}

export interface ArtistWithAlbumsID3 extends Artist {
  album?: Album[];
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  artists?: { id: string; name: string }[];
  displayArtist?: string;
  coverArt?: string;
  songCount: number;
  duration: number;
  created: string;
  year?: number;
  genre?: string;
  starred?: string;
}

export interface AlbumWithSongsID3 extends Album {
  song?: Track[];
}

export interface Track {
  id: string;
  parent?: string;
  title: string;
  album?: string;
  albumId?: string;
  artist?: string;
  artistId?: string;
  artists?: { id: string; name: string }[];
  displayArtist?: string;
  track?: number;
  year?: number;
  genre?: string;
  coverArt?: string;
  size?: number;
  contentType?: string;
  suffix?: string;
  duration: number;
  bitRate?: number;
  path?: string;
  created?: string;
  starred?: string;
}

export interface Playlist {
  id: string;
  name: string;
  comment?: string;
  owner?: string;
  public?: boolean;
  songCount: number;
  duration: number;
  created: string;
  coverArt?: string;
}

export interface PlaylistWithSongs extends Playlist {
  entry?: Track[];
}

export interface PlayQueue {
  current?: string;
  position?: number;
  username?: string;
  changed?: string;
  entry?: Track[];
}

export interface SearchResult3 {
  artist?: Artist[];
  album?: Album[];
  song?: Track[];
}

export interface Starred2 {
  artist?: Artist[];
  album?: Album[];
  song?: Track[];
}

export interface Index {
  name: string;
  artist: Artist[];
}

export interface ArtistsResponse {
  artists: {
    ignoredArticles?: string;
    index?: { name: string; artist: Artist[] }[];
  };
}

export interface GetAlbumList2Response {
  albumList2: {
    album: Album[];
  };
}

export interface GetPlaylistsResponse {
  playlists: {
    playlist: Playlist[];
  };
}

export interface GetPlaylistResponse {
  playlist: PlaylistWithSongs;
}

export interface GetArtistResponse {
  artist: ArtistWithAlbumsID3;
}

export interface GetAlbumResponse {
  album: AlbumWithSongsID3;
}

export interface SearchResponse3 {
  searchResult3: SearchResult3;
}

export interface GetStarred2Response {
  starred2: Starred2;
}

export interface GetRandomSongsResponse {
  randomSongs: {
    song: Track[];
  };
}

export interface MusicFolder {
  id: string;
  name: string;
}

export interface Indexes {
  lastModified: number;
  ignoredArticles: string;
  index?: Index[];
  child?: MusicFolder[];
}

export interface GetIndexesResponse {
  indexes: Indexes;
}

export interface ArtistInfo2 {
  biography?: string;
  musicBrainzId?: string;
  lastFmUrl?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  similarArtist?: Artist[];
}

export interface AlbumInfo {
  notes?: string;
  musicBrainzId?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  lastFmUrl?: string;
}

export interface GetArtistInfo2Response {
  artistInfo2: ArtistInfo2;
}

export interface GetAlbumInfo2Response {
  albumInfo: AlbumInfo;
}

export interface SimilarSongs2Response {
  similarSongs2?: {
    song?: Track[];
  };
}

export interface TopSongsResponse {
  topSongs?: {
    song?: Track[];
  };
}

export interface LyricsLine {
  start?: number;
  value?: string;
}

export interface StructuredLyrics {
  displayArtist?: string;
  displayTitle?: string;
  lang?: string;
  line?: LyricsLine[];
  offset?: number;
  synced?: boolean;
}

export interface GetLyricsResponse {
  lyricsList?: {
    structuredLyrics?: StructuredLyrics[];
  };
}

export interface SavePlayQueueResponse {
  playQueue?: PlayQueue;
}

export interface GetPlayQueueResponse {
  playQueue?: PlayQueue;
}

export interface Share {
  id: string;
  url: string;
  username?: string;
  created: string;
  expires?: string;
  lastVisited?: string;
  visitCount: number;
  description?: string;
  entry?: Track[];
}

export interface GetSharesResponse {
  shares?: {
    share?: Share[];
  };
}

export interface CreateShareResponse {
  shares?: {
    share?: Share[];
  };
}
