import {
  Body,
  Controller,
  Post,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from './supabase.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly testEmail: string;
  private readonly testPassword: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    // Properly get environment values
    this.testEmail = this.configService.get<string>('TEST_EMAIL');
    this.testPassword = this.configService.get<string>('TEST_EMAIL_PASSWORD');
  }

  @Post('signup')
  @ApiResponse({ status: 201, description: 'User successfully signed up.' })
  @ApiResponse({ status: 400, description: 'Invalid request data.' })
  async signUp(@Body() signupDto: SignupDto) {
    try {
      const { email, password } = signupDto;
      const supabase = this.supabaseService.getClient();
      const { user, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Supabase Signup Error:', error.message);
        throw new BadRequestException(`Signup failed: ${error.message}`);
      }

      return { user, message: 'Signup successful' };
    } catch (e) {
      console.error('Internal Server Error:', e);
      throw new InternalServerErrorException(
        'An error occurred during signup.',
      );
    }
  }

  @Post('login')
  @ApiResponse({ status: 201, description: 'User successfully logged in.' })
  @ApiResponse({ status: 400, description: 'Invalid credentials.' })
  async login(@Body() loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      const supabase = this.supabaseService.getClient();
      const { user, session, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase Login Error:', error.message);
        throw new BadRequestException(`Login failed: ${error.message}`);
      }

      return { user, session };
    } catch (e) {
      console.error('Internal Server Error:', e);
      throw new InternalServerErrorException('An error occurred during login.');
    }
  }
}
