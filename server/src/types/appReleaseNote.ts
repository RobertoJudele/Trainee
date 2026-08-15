export interface AppReleaseNoteAttributes {
  /** Semantic app version these notes describe, e.g. "1.3.0". */
  version: string;
  title: string;
  body: string;
  /**
   * Notes are hidden until this is true, so a row can be written before the
   * build reaches the stores without users seeing it early.
   */
  isPublished: boolean;
  updatedAt?: Date;
}

export interface AppReleaseNoteCreationAttributes {
  version: string;
  title: string;
  body: string;
  isPublished?: boolean;
}
