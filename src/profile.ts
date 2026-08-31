export type ProfileRole = Readonly<{
  mark: string
  title: string
  organization: string
}>

export type CardProfile = Readonly<{
  fullName: string
  givenName: string
  familyName: string
  roles: readonly [ProfileRole, ProfileRole]
  email: string
  linkedinUrl: string
  cardUrl: string
  discord: Readonly<{
    displayName: string
    username: string
    userId: string
  }>
}>
