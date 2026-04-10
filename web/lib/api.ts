import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RecommendationResponse {
  recommendations: any[];
  product_understanding: string;
  expanded_keywords: string[];
  error?: string;
}

export interface EstimateResponse {
  details: any[];
  summary: any;
  summary_comment?: string;
  error?: string;
}

export const fetchConfig = async () => {
  const res = await api.get('/api/config');
  return res.data;
};

export const fetchRecommendations = async (data: {
  product_name: string;
  website_url: string;
  num_recommendations: number;
}) => {
  const res = await api.post<RecommendationResponse>('/api/recommend', data);
  return res.data;
};

export const fetchEstimate = async (data: any) => {
  const res = await api.post<EstimateResponse>('/api/estimate', data);
  return res.data;
};

export const logVisit = async () => {
  try {
    await api.post('/api/log/visit', { ip_address: 'client' });
  } catch (e) {
    console.error("Failed to log visit", e);
  }
};

export const logInput = async (data: any) => {
  try {
    await api.post('/api/log/input', data);
  } catch (e) {
     console.error("Failed to log input", e);
  }
}

export const downloadReport = async (data: any) => {
    const res = await api.post('/api/report/download', data, {
        responseType: 'blob',
    });
    return res.data;
}
