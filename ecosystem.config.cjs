module.exports = {
  apps: [
    {
      name: 'tandem',
      script: './index.js',
      cwd: '/home/ubuntu/tandem',
      exec_mode: 'cluster',
      instances: 2,
      node_args: '--require dotenv/config',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
