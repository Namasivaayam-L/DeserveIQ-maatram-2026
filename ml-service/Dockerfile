FROM python:3.10-slim

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir \
    flask \
    numpy \
    pandas \
    scikit-learn \
    joblib

EXPOSE 5000

CMD ["python", "api_deserveiq.py"]
