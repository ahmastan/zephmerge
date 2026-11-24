import { Navigate } from 'react-router-dom'

/** /groups → the groups dashboard at /home. */
export default function GroupsIndex() {
  return <Navigate to="/home" replace />
}
