FROM python:3.11-slim

# Install dbt
RUN pip install --no-cache-dir \
    dbt-core==1.7.0 \
    dbt-postgres==1.7.0

# Create dbt user
RUN useradd -m -u 1000 dbtuser

WORKDIR /dbt

# Copy dbt project
COPY --chown=dbtuser:dbtuser . .

USER dbtuser

# Default command
CMD ["dbt", "run"]