import { useState } from "react";
import { searchContent, SearchQuery, SearchResultItem } from "../../api/search/searchApi";
import ArticleListItem from "../../components/common/ArticleListItem";
import DetailSearch from "../../components/common/DetailSearch";
import { useSearchStore } from '../../store/searchStore';

export default function SearchPage() {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const { keyword, category, sort, startDate, endDate, period, searchRange, resetSearch } = useSearchStore();

  const handleSearch = async () => {
    const isEmpty =
      !keyword && !category && sort === "latest" && !startDate && !endDate && !period;

    if (isEmpty) {
      setResults([]);
      resetSearch();
      setHasSearched(true);
      return;
    }

    try {
      const query: SearchQuery = {
        keyword,
        category: category || undefined,
        sort: sort as "latest" | "popular" | "rating",
        searchRange: searchRange || undefined,
        startDate: startDate ? startDate.toISOString().split("T")[0] : undefined,
        endDate: endDate ? endDate.toISOString().split("T")[0] : undefined,
        page: 1,
        size: 10,
      };
      const data = await searchContent(query);
      setResults(data.results);
    } catch (err) {
      console.error("검색 실패", err);
      setResults([]);
    } finally {
      setHasSearched(true);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <DetailSearch onSearch={handleSearch} />
      {results.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          {hasSearched && results.length === 0 && (
            <p>검색 결과가 없습니다.</p>
          )}
          {results.map(item => (
            <ArticleListItem
              key={item.id}
              {...item}
              onClick={(id) => console.log("Clicked article:", id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
