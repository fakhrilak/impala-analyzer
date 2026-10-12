docker build -t storage.zilog.zil:5000/impala-analyzer:1.0.1 .
docker push storage.zilog.zil:5000/impala-analyzer:1.0.1
kubectl apply -f k8s.yaml
