import { rateLimit } from 'express-rate-limit'

export function limiter(){
    rateLimit({ windowMs: 1*60*1000, max: 30 });
}