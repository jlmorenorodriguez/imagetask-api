/**
 * Configuration class for application settings
 */
export class AppConfig {
  /**
   * Returns the application port from environment or default
   */
  static getPort(): number {
    return parseInt(process.env.PORT, 10) || 3000;
  }

  /**
   * Returns the environment name
   */
  static getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Returns the API base URL
   */
  static getApiUrl(): string {
    return process.env.API_URL || `http://localhost:${this.getPort()}`;
  }

  /**
   * Logs application startup information
   */
  static logStartupInfo(): void {
    const port = this.getPort();
    console.log(`Application running on port ${port}`);
    console.log(
      `Swagger documentation available at http://localhost:${port}/api/docs`,
    );
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  }
}
