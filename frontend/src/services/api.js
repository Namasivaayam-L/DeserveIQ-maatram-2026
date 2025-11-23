import axios from 'axios'
import { API_SINGLE, API_BATCH, API_STUDENTS } from '../config'

const client = axios.create({ timeout: 30000 })

export const predictSingle = (payload) => client.post(API_SINGLE, payload).then(r => r.data)
export const predictBatch = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post(API_BATCH, fd, { headers: {'Content-Type':'multipart/form-data'}, responseType:'blob' })
}
export const getStudents = () => client.get(API_STUDENTS).then(r=>r.data)
export const createStudent = (payload) => client.post(API_STUDENTS, payload).then(r=>r.data)
export const getStudent = (id) => client.get(`${API_STUDENTS}/${id}`).then(r=>r.data)
export const deleteStudent = (id) =>
  client.delete(`${API_STUDENTS}/${id}`).then(r => r.data);
