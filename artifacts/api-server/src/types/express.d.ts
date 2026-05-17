declare namespace Express {
    interface Request {
        clinicId: string;
            auth?: {
                  userId?: string;
                        [key: string]: unknown;
                            };
                              }
                              
}