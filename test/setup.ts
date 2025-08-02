// Basic test environment setup
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/image_processing_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.OUTPUT_DIRECTORY = './test-output';
process.env.MAX_FILE_SIZE = '10485760';
process.env.SUPPORTED_FORMATS = 'jpg,jpeg,png,webp';
process.env.IMAGE_RESOLUTIONS = '1024,800';
