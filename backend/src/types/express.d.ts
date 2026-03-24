declare namespace Express {
  interface Request {
    authUser?: {
      id: number;
      email: string;
      name: string | null;
    };
  }
}
