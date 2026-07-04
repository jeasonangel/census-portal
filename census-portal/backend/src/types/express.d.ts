export interface AuthenticatedUser {
  id: number;
  email: string;
  user_type: string;
  plan?: string;
  monthly_limit?: number;
  requests_used?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      apiKeyId?: number;
    }
  }
}

export {};
