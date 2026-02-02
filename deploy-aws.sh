#!/bin/bash

# AWS Deployment Script for CHON Personality Test

echo "CHON AWS Deployment Script"
echo "=========================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not installed${NC}"
    echo "Install from: https://aws.amazon.com/cli/"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI found${NC}"

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not installed${NC}"
    echo "Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo -e "${GREEN}✓ Docker found${NC}"

# Deployment options
echo ""
echo "Select deployment option:"
echo "1) Deploy Backend to Elastic Beanstalk"
echo "2) Deploy Frontend to S3 + CloudFront"
echo "3) Deploy Both"
echo "4) Deploy using Docker Compose to EC2"
echo ""
read -p "Enter option (1-4): " option

case $option in
    1)
        echo -e "${YELLOW}Deploying Backend to Elastic Beanstalk...${NC}"
        cd backend
        eb init -p python-3.11 chon-backend --region us-east-1
        eb create chon-backend-prod
        eb setenv SUPABASE_URL=$SUPABASE_URL SUPABASE_KEY=$SUPABASE_KEY
        eb deploy
        ;;
    2)
        echo -e "${YELLOW}Deploying Frontend to S3...${NC}"
        cd frontend
        npm run build
        aws s3 sync dist/ s3://chon-frontend/ --delete
        aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
        ;;
    3)
        echo -e "${YELLOW}Deploying Both...${NC}"
        $0 1
        $0 2
        ;;
    4)
        echo -e "${YELLOW}Deploying with Docker Compose...${NC}"
        docker-compose build
        docker save -o chon-app.tar backend frontend
        echo "Upload chon-app.tar to EC2 and run: docker load -i chon-app.tar && docker-compose up -d"
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Deployment complete!${NC}"

