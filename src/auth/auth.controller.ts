import {
  Body,
  Controller,
  Post,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
  HttpCode,
  Get,
  Query,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from './supabase.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly testEmail: string;
  private readonly testPassword: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.testEmail = this.configService.get<string>('TEST_EMAIL');
    this.testPassword = this.configService.get<string>('TEST_EMAIL_PASSWORD');
  }

  private getSupabaseClient() {
    const supabase = this.supabaseService.getClient();
    if (!supabase) {
      this.logger.error('Failed to initialize Supabase client.');
      throw new InternalServerErrorException('Supabase client not initialized');
    }
    return supabase;
  }

  @Post('signup')
  @ApiResponse({ status: 201, description: 'User successfully signed up.' })
  @ApiResponse({ status: 400, description: 'Invalid request data.' })
  async signup(@Body() signupDto: SignupDto) {
    try {
      const { email, password, confirmPassword } = signupDto;
      
      // Validate password confirmation
      if (password !== confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      const { data, error } = await this.supabaseService
        .getClient()
        .auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
            data: {
              email_verified: false,
            }
          }
        });

      // Handle Supabase response
      if (error) {
        this.logger.error('Supabase signup error:', error);
        
        // Check for specific error cases
        if (error.message?.includes('User already registered') || 
            error.message?.includes('already exists')) {
          throw new ConflictException('User with this email already exists');
        }
        
        throw new BadRequestException(error.message);
      }

      // Check for repeated signup
      if (data?.user?.aud === 'authenticated') {
        throw new ConflictException('User with this email already exists');
      }

      return {
        message: 'Signup successful. Please check your email for verification.',
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at
        }
      };

    } catch (error) {
      this.logger.error('Signup error:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('An error occurred during signup');
    }
  }

  @Post('login')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'User successfully logged in.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials or email not verified.',
  })
  async login(@Body() loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      
      const { data, error } = await this.supabaseService
        .getClient()
        .auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        this.logger.error('Login error:', error);
        throw new UnauthorizedException(error.message);
      }

      const userData = data.user;
      
      return {
        message: 'Login successful',
        user: {
          id: userData.id,
          email: userData.email,
          email_confirmed_at: userData.email_confirmed_at,
          last_sign_in_at: userData.last_sign_in_at
        },
        session: {
          access_token: data.session.access_token,
          expires_at: data.session.expires_at
        }
      };

    } catch (error) {
      this.logger.error('Login error:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('An error occurred during login');
    }
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .auth.resend({
          type: 'signup',
          email,
        });

      if (error) {
        this.logger.error(`Failed to resend verification: ${error.message}`);
        throw new BadRequestException(error.message);
      }

      return {
        message: 'Verification email has been resent. Please check your inbox.',
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to resend verification email');
    }
  }

  @Post('test-login')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Test login response.' })
  testLogin() {
    return {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
      accessToken: 'dummy-token',
    };
  }

  @Get('verify')
  async verifyEmail(@Query('token') token: string) {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .auth.verifyOtp({
          token_hash: token,
          type: 'email',
        });

      if (error) {
        throw new BadRequestException('Invalid or expired verification link');
      }

      return {
        message: 'Email verified successfully. You can now log in.',
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to verify email');
    }
  }
}
