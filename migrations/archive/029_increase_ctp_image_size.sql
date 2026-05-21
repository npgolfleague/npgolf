-- Increase ctp_image_url column size to support base64 encoded images
ALTER TABLE scores MODIFY COLUMN ctp_image_url MEDIUMTEXT DEFAULT NULL;
