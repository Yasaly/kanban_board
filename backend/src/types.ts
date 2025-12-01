export type UserRole = 'user' | 'admin';

export type AuthUser = {
    id: number;
    email: string;
    role: UserRole;
};
