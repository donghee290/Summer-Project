import axiosInstance from '../axiosInstance';

interface LoginPayload {
    username: string;
    password: string;
}

interface LoginResponse {
    message: string;
    token: string;
}

interface RegisterPayload {
    username: string;
    password: string;
    email: string;
}

interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        username: string;
        email: string;
    };
}

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
    console.log(payload);
    const response = await axiosInstance.post<LoginResponse>('/user/login', payload); 
    console.log(response.data);
    return response.data;
};

export const register = async (payload: RegisterPayload): Promise<{ message: string }> => {
    const response = await axiosInstance.post<{ message: string }>('/user/register', payload);
    return response.data;
};

export const checkDuplicateId = async (username: string): Promise<{ available: boolean }> => {
    const response = await axiosInstance.get<{ available: boolean }>(`/user/check-id`, {
        params: { username }
    });
    return response.data;
};

export const resetPassword = async (
  payload: { username: string; email: string }
): Promise<{ message: string; tempPassword: string }> => {
  const response = await axiosInstance.post<{ message: string; tempPassword: string }>(
    '/user/password-reset',
    payload
  );
  return response.data;
};