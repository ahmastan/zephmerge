/** Row shapes as seen by the client (useQuery<T>). */

export interface Group {
  groupId: string
  name: string
  joinCode: string
  ownerId: string
  lastMergedAt?: string
  lastMergedBy?: string
}

export interface Member {
  teamId: string
  userId: string
  status?: 'active' | 'inactive'
  displayName?: string
  imageUrl?: string
  role?: 'owner' | 'member'
}

export interface Note {
  groupId: string
  lectureLabel: string
  body: string
  authorId: string
  authorName?: string
  sampleAuthor?: string
}
