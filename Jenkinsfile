// PRD pipeline for siri_autopost_ui (Jenkins job: SIRIAUTOPOST-WEB).
// Builds the Angular dashboard (nginx image, see Dockerfile), pushes it to the local registry and deploys it
// into namespace siriautopost, served at https://siriautopost.siristudiophoto.com.
//
// Same conventions as the SIRISTUDIOPHOTO jobs: docker + kubectl on the Jenkins host, registry localhost:5000.
// nginx.conf proxies /api to http://api:8080, so SIRIAUTOPOST-BACKEND must have deployed Service `api` first
// Service `ui` is NodePort 30907; the Cloudflare tunnel `siri-monitor` routes the public host to
// http://172.17.0.1:30907. No Jenkins credential is needed.

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        K8S_NAMESPACE = 'siriautopost'
        OVERLAY       = 'deploy/k8s/overlays/prd'
        UI_IMAGE      = 'localhost:5000/siriautopost-web'
        PUBLIC_URL    = 'https://siriautopost.siristudiophoto.com'
    }

    stages {
        stage('Prepare') {
            steps {
                script {
                    env.IMAGE_TAG = "prd-${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
                }
                echo "Image tag: ${env.IMAGE_TAG}"
            }
        }

        stage('Build and push image') {
            steps {
                sh '''
                    set -eu
                    docker build -t "$UI_IMAGE:$IMAGE_TAG" .
                    docker push "$UI_IMAGE:$IMAGE_TAG"
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -eu
                    K="kubectl -n $K8S_NAMESPACE"

                    # Jenkins runs as ci:jenkins-deployer, which cannot create namespaces: the namespace and its
                    # RoleBinding are created once by a cluster admin (deploy/README.md in siri_autopost_backend).
                    if ! $K get service api >/dev/null 2>&1; then
                        echo "Service api not found in $K8S_NAMESPACE: run SIRIAUTOPOST-BACKEND first (nginx proxies /api to it)" >&2
                        exit 1
                    fi

                    # Pin the image built above (workspace copy only, not committed).
                    sed -i "s/newTag: .*/newTag: $IMAGE_TAG/" "$OVERLAY/kustomization.yaml"
                    kubectl apply -k "$OVERLAY"
                    $K rollout status deployment/ui --timeout=180s
                '''
            }
        }

        stage('Smoke test') {
            steps {
                // NodePort first (what the tunnel points at), then the public host, which needs the tunnel route.
                sh 'curl -fsS -o /dev/null --retry 6 --retry-delay 5 --retry-all-errors http://172.17.0.1:30907/'
                catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                    sh 'curl -fsS -o /dev/null --retry 12 --retry-delay 10 --retry-all-errors "$PUBLIC_URL/"'
                }
            }
        }
    }

    post {
        cleanup {
            sh 'docker image prune -f'
        }
    }
}
