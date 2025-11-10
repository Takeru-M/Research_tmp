# 開発/本番 共通（LaravelはPHP-FPMを利用）
FROM php:8.2-fpm-alpine

# システムパッケージのインストール
RUN apk add --no-cache \
    $PHPIZE_DEPS \
    icu-dev \
    libxml2-dev \
    oniguruma-dev \
    libzip-dev \
    git \
    bash \
    curl

# PHP拡張のインストール
RUN docker-php-ext-install pdo_mysql opcache intl pcntl zip

# Composerのインストール
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# 実行ユーザーの追加（セキュリティ向上）
RUN addgroup -g 1000 laravel && adduser -u 1000 -G laravel -S laravel
USER laravel

EXPOSE 9000
CMD ["php-fpm"]