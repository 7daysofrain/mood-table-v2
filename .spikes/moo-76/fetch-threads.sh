#!/usr/bin/env bash
# Hilos de revisión de todas las PR integradas o cerradas, a data/threads.json
set -euo pipefail
q='query($c:String){repository(owner:"7daysofrain",name:"mood-table-v2"){pullRequests(first:40,after:$c,states:[MERGED,CLOSED],orderBy:{field:CREATED_AT,direction:DESC}){pageInfo{hasNextPage endCursor} nodes{number title state body headRefName mergedAt reviewThreads(first:60){nodes{isResolved isOutdated path line originalLine comments(first:15){nodes{author{login} body createdAt diffHunk originalCommit{oid} commit{oid}}}}}}}}}'
cursor=null; out=data/prs.jsonl; : > $out
while :; do
  if [ "$cursor" = null ]; then r=$(gh api graphql -f query="$q"); else r=$(gh api graphql -f query="$q" -F c="$cursor"); fi
  echo "$r" | jq -c '.data.repository.pullRequests.nodes[]' >> $out
  [ "$(echo "$r" | jq '.data.repository.pullRequests.pageInfo.hasNextPage')" = true ] || break
  cursor=$(echo "$r" | jq -r '.data.repository.pullRequests.pageInfo.endCursor')
done
wc -l $out
