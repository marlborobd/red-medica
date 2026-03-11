import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getUsers = () => api.get('/auth/users');
export const getEmployees = () => api.get('/auth/employees');
export const createUser = (data) => api.post('/auth/users', data);
export const updateUser = (id, data) => api.put(`/auth/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/auth/users/${id}`);

// Patients
export const getPatients = (search) => api.get('/patients', { params: { search } });
export const getPatient = (id) => api.get(`/patients/${id}`);
export const createPatient = (data) => api.post('/patients', data);
export const updatePatient = (id, data) => api.put(`/patients/${id}`, data);
export const deletePatient = (id) => api.delete(`/patients/${id}`);
export const getPendingPatients = () => api.get('/patients/pending');
export const updatePatientStatus = (id, status) => api.put(`/patients/${id}/status`, { status });
export const redistribuiePatient = (id, redirectionat_catre_id) => api.put(`/patients/${id}/redistribuie`, { redirectionat_catre_id });

// Visits
export const getVisits = (patientId) => api.get(`/visits/patient/${patientId}`);
export const getVisit = (id) => api.get(`/visits/${id}`);
export const createVisit = (data) => api.post('/visits', data);
export const updateVisit = (id, data) => api.put(`/visits/${id}`, data);
export const deleteVisit = (id) => api.delete(`/visits/${id}`);

// Upload
export const uploadPhoto = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// Scheduled visits
export const getScheduledVisits = () => api.get('/scheduled-visits');
export const createScheduledVisit = (data) => api.post('/scheduled-visits', data);
export const markScheduledEffectuata = (id) => api.put(`/scheduled-visits/${id}/efectuat`);
export const deleteScheduledVisit = (id) => api.delete(`/scheduled-visits/${id}`);

// Push notifications
export const getVapidPublicKey = () => api.get('/push/vapid-public-key');
export const subscribeToPush = (subscription) => api.post('/push/subscribe', subscription);

// Reports
export const getReportSummary = () => api.get('/reports/summary');
export const getReportMonthly = (year) => api.get('/reports/monthly', { params: { year } });
export const getReportEmployees = () => api.get('/reports/employees');
export const getVisitsDetail = (params) => api.get('/reports/visits-detail', { params });

export const triggerManualBackup = () => api.get('/backup/manual');
export const triggerBackupManual = () => api.post('/backup/manual');
export const getBackupStatus = () => api.get('/backup/status');

export default api;
