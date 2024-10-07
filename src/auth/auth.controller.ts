import { Controller, Post, Body } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('signup')
  async signUp(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    const supabase = this.supabaseService.getClient();
    const { user, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
    return user;
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    const supabase = this.supabaseService.getClient();
    const { user, session, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
    return { user, session };
  }
}
