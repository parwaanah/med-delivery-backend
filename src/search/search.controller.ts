import { Controller, Get, Query } from "@nestjs/common";
import { SearchService } from "./search.service";

@Controller("medicines")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("search")
  async search(@Query("query") query: string) {
    return await this.searchService.search(query);
  }
}
