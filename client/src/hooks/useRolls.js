import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useRolls(statusFilter) {
  return useQuery({
    queryKey: ['rolls', statusFilter],
    queryFn: async () => {
      const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const { data } = await api.get('/api/rolls', { params });
      return data;
    },
  });
}

export function useRoll(id) {
  return useQuery({
    queryKey: ['roll', id],
    queryFn: async () => {
      const { data } = await api.get('/api/rolls');
      return data.find((r) => r.id === id) || null;
    },
    enabled: !!id,
  });
}

export function useCreateRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rollData) => api.post('/api/rolls', rollData).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
    },
  });
}

export function useUpdateRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/api/rolls/${id}`, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
      queryClient.invalidateQueries({ queryKey: ['roll', id] });
    },
  });
}

export function useDeleteRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/rolls/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
    },
  });
}
